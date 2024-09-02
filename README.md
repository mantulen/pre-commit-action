# pre-commit action with PR comments :rocket:

[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit)](https://github.com/pre-commit/pre-commit)
[![Super-Linter](https://github.com/mantulen/pre-commit-action/actions/workflows/linter.yml/badge.svg)](https://github.com/mantulen/pre-commit-action/actions/workflows/linter.yml)
[![CI](https://github.com/mantulen/pre-commit-action/actions/workflows/ci.yml/badge.svg)](https://github.com/mantulen/pre-commit-action/actions/workflows/ci.yml)
[![Check dist/](https://github.com/mantulen/pre-commit-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/mantulen/pre-commit-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/mantulen/pre-commit-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/mantulen/pre-commit-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](https://mantulen.github.io/pre-commit-action/)

This action runs pre-commit against your code, creates a job summary, and adds a comment on your pull request with the
results of the run.

⚠️ **This action is under active development, and is yet to be released to the marketplace.**

## Screenshot

![image](https://github.com/user-attachments/assets/3669617e-e667-489c-bd07-a1930a87bd95)

## Settings

### Inputs

All inputs are optional.

| Key Name           | Required | Example                                          | Default Value                | Description                                                                                                                                                              |
| ------------------ | :------: | ------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `base-url`         |    No    | `https://my.github-enterprise-server.com/api/v3` | `https://api.github.com`     | An optional GitHub REST API URL to connect to a different GitHub instance                                                                                                |
| `github-token`     |    No    | `gho_******`                                     | `${{ github.token }}`        | The GitHub token used to create an authenticated client                                                                                                                  |
| `issue-number`     |    No    | `101`                                            | `${{ github.event.number }}` | ID of the issue or pull request to comment on. Default is the number of the pull request that triggered the action                                                       |
| `skip-comment`     |    No    | `true`                                           | `false`                      | Whether to skip commenting on the pull request. true or false                                                                                                            |
| `skip-job-summary` |    No    | `true`                                           | `false`                      | Whether to skip adding result to the job summary. true or false                                                                                                          |
| `debug`            |    No    | `true`                                           | `${{ runner.debug == '1' }}` | Whether to tell the GitHub client to log details of its requests. true or false. Default is to run in debug mode when the GitHub Actions step debug logging is turned on |
| `python-path`      |    No    | `/usr/local/python/current/bin/python`           | `python`                     | Custom path to Python executable                                                                                                                                         |
| `pre-commit-path`  |    No    | `/home/vscode/.local/bin/pre-commit`             | `pre-commit`                 | Custom path to pre-commit executable                                                                                                                                     |

### Outputs

| Key Name | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `result` | Pre-commit result in JSON format, if you need to use the output in a later step |

## Example workflow yaml

Place in `/.github/workflows/pre-commit-check.yml`

```yml
on:
    pull_request:
        branches:
            - main
    push:
        branches:
            - main

permissions:
    contents: read
    pull-requests: write

jobs:
    ci-checks:
        name: Run continuous integration checks
        runs-on: ubuntu-latest

        steps:
            - name: Checkout
              uses: actions/checkout@v4

            - name: Run pre-commit checks
              id: run-pre-commit
              uses: mantulen/pre-commit-action@main

            - name: Print Output
              id: output
              run: echo "${{ steps.run-pre-commit.outputs.result }}"
```
