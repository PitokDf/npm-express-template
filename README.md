# npm-express-template

CLI generator untuk membuat project Express TypeScript.

Usage:

- Generate project and ask for options interactively:

  npx install-express create my-app

- Generate project and include Docker artifacts:

  npx install-express create my-app --include-docker

- Generate project and exclude Docker artifacts (delete Dockerfile / docker-compose):

  npx install-express create my-app --exclude-docker

- Create into current directory:

  npx install-express create .

When `--exclude-docker` (or the interactive prompt answers `No`), the CLI removes these files/directories if present in the template:

- Dockerfile
- docker-compose.yml
- .dockerignore
- docker/ directory

The CLI will also update package.json `name` field and install dependencies.
