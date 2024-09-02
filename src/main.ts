import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import type { OctokitOptions } from '@octokit/core/dist-types/types'

interface ResultDataType {
    [hookId: string]: {
        duration: string
        icon: string
        result: string
        exitCode: string
        error: string
    }
}

interface ErrorDataType {
    [hookId: string]: string
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    const pythonPath = core.getInput('python-path') || 'python'
    const preCommitPath = core.getInput('pre-commit-path') || 'pre-commit'
    const isJest = process.env.JEST_WORKER_ID !== undefined
    const isCI = process.env.CI !== undefined

    let pythonVersion = ''
    let preCommitVersion = ''

    // Check if Python is installed and get the version
    core.debug(`Checking python path: ${pythonPath}`)
    try {
        await exec.exec(pythonPath, ['--version'], {
            failOnStdErr: false,
            ignoreReturnCode: true,
            errStream: process.stdout,
            listeners: {
                stdout: (data: Buffer) => {
                    pythonVersion = data.toString()
                }
            }
        })
    } catch (err) {
        console.debug(`Python not found: ${pythonPath}`)
    }

    // If Python is not installed, the action will fail
    if (!pythonVersion) {
        core.setOutput('result', '{}')
        if (!(isCI && isJest)) {
            core.setFailed('Python is required to run this action.')
        }
        return
    }
    core.info(`Python version: ${pythonVersion}`)

    // Check if pre-commit is installed and get the version
    core.debug(`Checking pre-commit path: ${preCommitPath}`)
    try {
        await exec.exec(preCommitPath, ['--version'], {
            failOnStdErr: false,
            ignoreReturnCode: true,
            errStream: process.stdout,
            listeners: {
                stdout: (data: Buffer) => {
                    preCommitVersion = data.toString()
                }
            }
        })
    } catch (err) {
        console.debug(`pre-commit not found: ${preCommitPath}`)
    }

    // If pre-commit is not installed, install it
    if (!preCommitVersion) {
        core.info('Installing pre-commit...')
        await exec.exec(pythonPath, ['-m', 'pip', 'install', 'pre-commit'])
    } else {
        core.info(`pre-commit version: ${preCommitVersion}`)
    }

    const context = github.context
    const baseUrl = core.getInput('base-url') || 'https://api.github.com'
    const token =
        core.getInput('github-token') || process.env.GITHUB_TOKEN || ''
    const issueNumber =
        parseInt(core.getInput('issue-number')) ||
        context.payload?.pull_request?.number ||
        1
    const debug = core.getBooleanInput('debug') || core.isDebug()

    const options: OctokitOptions = {
        baseUrl,
        log: debug ? console : undefined
    }

    const octokit = github.getOctokit(token, options)

    const resultData: ResultDataType = {}
    const errorData: ErrorDataType = {}

    let lastHookId: string
    let lastResult: string
    let returnCode = 0

    core.info('Running pre-commit...')

    // preCommitArgs input is for jest testing only, at this time
    const preCommitArgsInput = core.getInput('pre-commit-args') || ''
    const preCommitArgs = preCommitArgsInput
        ? preCommitArgsInput.split(' ')
        : ['run', '--color', 'never', '--all-files', '--verbose']

    try {
        returnCode = await exec.exec('pre-commit', preCommitArgs, {
            failOnStdErr: false,
            ignoreReturnCode: true,
            errStream: process.stdout,
            listeners: {
                stdline: data => {
                    const line = data.toString()
                    const result = line.match(
                        /(?<result>Passed|Failed|Skipped)$/
                    )?.groups?.result
                    const hookId = line.match(/(- hook id: )(?<hookid>.+)/)
                        ?.groups?.hookid
                    const duration = line.match(/(- duration: )(?<duration>.+)/)
                        ?.groups?.duration
                    const exitCode = line.match(
                        /(- exit code: )(?<exitcode>.+)/
                    )?.groups?.exitcode
                    const skipLine = line.match(
                        /\d+ (files left unchanged)/
                    )?.length

                    if (result) {
                        lastResult = result
                    } else if (hookId) {
                        resultData[hookId] = {
                            duration: '',
                            icon:
                                lastResult === 'Passed'
                                    ? '✅'
                                    : lastResult === 'Failed'
                                      ? '❌'
                                      : '⚠️',
                            result: lastResult,
                            exitCode: '0',
                            error: ''
                        }
                        lastHookId = hookId
                    } else if (duration) {
                        resultData[lastHookId].duration = duration
                    } else if (exitCode) {
                        resultData[lastHookId].exitCode = exitCode
                    } else if (
                        line &&
                        !skipLine &&
                        resultData[lastHookId].exitCode
                    ) {
                        resultData[lastHookId].error += `${line}\n`
                    }
                }
            }
        })
    } catch (err) {
        /* istanbul ignore next */
        console.debug(err)
    }

    let commentBody = '## pre-commit results\n\n| Hook ID | Duration | Result |'

    if (returnCode === 0) {
        core.info('all pre-commit hooks have passed!')
        commentBody += '\n| :--- | :---: | --- |\n'
    } else {
        if (!(isCI && isJest)) {
            core.setFailed('pre-commit checks have failed.')
        }
        commentBody += ' Exit code |\n| :--- | :---: | --- | :---: |\n'
    }

    for (const [key, value] of Object.entries(resultData)) {
        commentBody += `| ${key} | ${value.duration} | ${value.icon} ${value.result} |`
        commentBody += returnCode === 0 ? '\n' : ` ${value.exitCode} |\n`
        if (value.error) {
            errorData[key] = value.error
        }
    }

    if (Object.keys(errorData).length) {
        commentBody += '\n### Failures\n'
        for (const [key, value] of Object.entries(errorData)) {
            commentBody += `\n<details>\n<summary>${key}</summary>\n\n\`\`\`\n${value}\`\`\`\n</details>\n`
        }
    }

    core.setOutput(
        'result',
        JSON.stringify({
            returnCode,
            resultData,
            errorData
        })
    )

    if (!issueNumber) {
        /* istanbul ignore next */
        core.warning(
            'No PR/issue number found, will not be creating a comment. You can pass the PR/issue number using the `issue-number` input.'
        )
    } else {
        await octokit.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issueNumber,
            body: commentBody
        })
    }
}
