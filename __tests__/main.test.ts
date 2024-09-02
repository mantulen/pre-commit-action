/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as main from '../src/main'
import * as core from '@actions/core'
import fs from 'fs'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let infoMock: jest.SpiedFunction<typeof core.info>
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof core.getBooleanInput>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>

describe('action', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetModules()

        infoMock = jest.spyOn(core, 'info').mockImplementation()
        debugMock = jest.spyOn(core, 'debug').mockImplementation()
        errorMock = jest.spyOn(core, 'error').mockImplementation()
        getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
        getBooleanInputMock = jest
            .spyOn(core, 'getBooleanInput')
            .mockImplementation()
        setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

        getBooleanInputMock.mockImplementation(param => {
            switch (param) {
                case 'debug':
                    return true
                default:
                    return false
            }
        })
    })

    it('verify failed run, python missing', async () => {
        getInputMock.mockImplementation(param => {
            switch (param) {
                case 'python-path':
                    return '/fake/path/to/python'
                default:
                    return ''
            }
        })
        await main.run()
        expect(runMock).toHaveReturned()

        expect(debugMock).toHaveBeenNthCalledWith(
            1,
            'Checking python path: /fake/path/to/python'
        )
        expect(setOutputMock).toHaveBeenNthCalledWith(1, 'result', '{}')
    })

    it('verify failed run, pre-commit errors', async () => {
        const testFile = `__tests__/test-${Math.random()}.py`
        getInputMock.mockImplementation(param => {
            switch (param) {
                case 'pre-commit-args':
                    return `run --config __tests__/.pre-commit-config-test.yaml --files ${testFile} --verbose`
                default:
                    return ''
            }
        })

        fs.writeFileSync(testFile, 'import fake_module\n')

        await main.run()
        expect(runMock).toHaveReturned()

        fs.unlinkSync(testFile)

        expect(debugMock).toHaveBeenNthCalledWith(
            1,
            'Checking python path: python'
        )
        expect(infoMock).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/Python \d+\.\d+\.\d+/)
        )
        expect(debugMock).toHaveBeenNthCalledWith(
            2,
            'Checking pre-commit path: pre-commit'
        )
        expect(infoMock).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/pre-commit \d+\.\d+\.\d+/)
        )
        expect(infoMock).toHaveBeenNthCalledWith(3, 'Running pre-commit...')
    })

    it('verify successful run, pre-commit missing', async () => {
        getInputMock.mockImplementation(param => {
            switch (param) {
                case 'pre-commit-path':
                    return '/fake/path/to/pre-commit'
                default:
                    return ''
            }
        })
        await main.run()
        expect(runMock).toHaveReturned()

        expect(debugMock).toHaveBeenNthCalledWith(
            1,
            'Checking python path: python'
        )
        expect(infoMock).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/Python \d+\.\d+\.\d+/)
        )
        expect(debugMock).toHaveBeenNthCalledWith(
            2,
            'Checking pre-commit path: /fake/path/to/pre-commit'
        )
        expect(infoMock).toHaveBeenNthCalledWith(2, 'Installing pre-commit...')
        expect(infoMock).toHaveBeenNthCalledWith(3, 'Running pre-commit...')
        expect(infoMock).toHaveBeenNthCalledWith(
            4,
            'all pre-commit hooks have passed!'
        )
        expect(errorMock).not.toHaveBeenCalled()
    })

    it('verify successful run, no pre-commit errors', async () => {
        await main.run()
        expect(runMock).toHaveReturned()

        expect(debugMock).toHaveBeenNthCalledWith(
            1,
            'Checking python path: python'
        )
        expect(infoMock).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/Python \d+\.\d+\.\d+/)
        )
        expect(debugMock).toHaveBeenNthCalledWith(
            2,
            'Checking pre-commit path: pre-commit'
        )
        expect(infoMock).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/pre-commit \d+\.\d+\.\d+/)
        )
        expect(infoMock).toHaveBeenNthCalledWith(3, 'Running pre-commit...')
        expect(infoMock).toHaveBeenNthCalledWith(
            4,
            'all pre-commit hooks have passed!'
        )
        expect(setOutputMock).toHaveBeenCalled()
        expect(errorMock).not.toHaveBeenCalled()
    })
})
