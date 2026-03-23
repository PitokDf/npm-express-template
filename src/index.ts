import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fsExtra from 'fs-extra';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

function printHeader() {
    const msg = figlet.textSync('Express by Pitok', {
        font: 'Slant',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });

    console.log(gradient.rainbow(msg));
    const boxMsg = boxen('🚀 Generator Express TypeScript by Pitok', {
        padding: 0,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#1a1a1a'
    });
    console.log(boxMsg);
}


const args = process.argv.slice(2);

async function main() {
    if (args[0] === 'create') {
        printHeader()
        // parse remaining args after the `create` command
        const afterCreateArgs = args.slice(1);
        let projectName = afterCreateArgs.find(a => !a.startsWith('-')) as string | undefined;

        // parse simple flags
        const flags = afterCreateArgs.filter(a => a.startsWith('-'));
        const includeDockerFlag = flags.includes('--include-docker') || flags.includes('--docker') || flags.includes('-d');
        const excludeDockerFlag = flags.includes('--exclude-docker') || flags.includes('--no-docker') || flags.includes('-D');

        // conflicting flags check
        if (includeDockerFlag && excludeDockerFlag) {
            console.error(chalk.red('⚠️  Tidak bisa menggunakan --include-docker dan --exclude-docker bersamaan.')); // Indonesian message
            process.exit(1);
        }

        if (!projectName) {
            const response = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Masukkan nama project:',
                    default: 'my-express-app',
                },
            ]);
            projectName = response.name;
        }

        // resolve includeDocker option (flags override prompt)
        let includeDocker: boolean | undefined;
        if (includeDockerFlag) includeDocker = true;
        else if (excludeDockerFlag) includeDocker = false;
        else {
            const { includeDocker: answered } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'includeDocker',
                    message: 'Sertakan Dockerfile',
                    default: false,
                },
            ]);
            includeDocker = answered;
        }

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'pkgManager',
                message: 'Pilih package manager yang ingin digunakan:',
                choices: ['npm', 'bun'],
                default: 'npm'
            },
            {
                type: 'list',
                name: 'dbEngine',
                message: 'Pilih Database Engine Prisma:',
                choices: ['postgresql', 'mysql', 'sqlite'],
                default: 'postgresql'
            },
            {
                type: 'list',
                name: 'loggerChoice',
                message: 'Pilih Logger yang akan digunakan:',
                choices: ['winston (Default, kaya fitur)', 'pino (High Performance)'],
                default: 'winston (Default, kaya fitur)'
            },
            {
                type: 'confirm',
                name: 'addSwagger',
                message: 'Integrasikan API Documentation (Swagger UI)?',
                default: true
            },
            {
                type: 'confirm',
                name: 'addPm2',
                message: 'Tambahkan konfigurasi PM2 (ecosystem.config.js)?',
                default: true
            },
            {
                type: 'confirm',
                name: 'addCi',
                message: 'Tambahkan GitHub Actions CI/CD Pipeline?',
                default: true
            },
            {
                type: 'confirm',
                name: 'installDeps',
                message: 'Install dependencies otomatis?',
                default: true
            },
            {
                type: 'confirm',
                name: 'initGit',
                message: 'Inisialisasi Git repository baru?',
                default: true
            }
        ]);
        const { pkgManager, dbEngine, loggerChoice, addSwagger, addPm2, addCi, installDeps, initGit } = answers;

        let useBunTest = false;
        if (pkgManager === 'bun') {
            const res = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'useBunTest',
                    message: 'Karena Anda memilih Bun, apakah ingin membuang Jest dan menggunakan native Bun Test?',
                    default: true
                }
            ]);
            useBunTest = res.useBunTest;
        }

        const rawInput = projectName as string;
        const isCurrentDir = rawInput === '.';
        const targetPath = isCurrentDir ? process.cwd() : path.resolve(process.cwd(), rawInput);
        const finalProjectName = isCurrentDir ? path.basename(targetPath) : rawInput;

        // Validasi folder
        if (isCurrentDir && fs.readdirSync(process.cwd()).length > 0) {
            console.error(chalk.red('Folder saat ini tidak kosong. Tidak bisa melakukan instalasi.'));
            process.exit(1);
        }

        if (fs.existsSync(targetPath) && !isCurrentDir) {
            console.error(chalk.red(`Folder "${finalProjectName}" sudah ada.`));
            process.exit(1);
        }

        const repoUrl = 'https://github.com/PitokDf/express-app-useable.git';

        console.log(chalk.blue(`⬇️  Meng-clone template ke "${isCurrentDir ? 'folder saat ini' : finalProjectName}"...`));
        execSync(`git clone ${repoUrl} "${isCurrentDir ? '.' : finalProjectName}"`, { stdio: 'inherit' });

        // 🔥 Hapus .git
        const gitPath = path.join(targetPath, '.git');
        if (fs.existsSync(gitPath)) {
            fsExtra.removeSync(gitPath);
        }

        // ✏️ Ubah package.json → name dan sesuaikan dengan package manager
        const pkgJsonPath = path.join(targetPath, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            pkg.name = finalProjectName;

            if (pkgManager === 'bun') {
                // Downgrade Prisma to stable 5.22.0 specifically for Bun isolated processes to survive Edge collision.
                if (pkg.dependencies['@prisma/client']) pkg.dependencies['@prisma/client'] = '^5.22.0';
                if (pkg.dependencies['prisma']) pkg.dependencies['prisma'] = '^5.22.0';
                if (pkg.dependencies['@prisma/adapter-pg']) pkg.dependencies['@prisma/adapter-pg'] = '^5.22.0';

                // Rewrite schema for Prisma 5.22 which requires explicit URL strings unlike 7.4 Canary
                const schemaPath = path.join(targetPath, 'prisma', 'schema.prisma');
                if (fs.existsSync(schemaPath)) {
                    let schemaContent = fs.readFileSync(schemaPath, 'utf-8');
                    if (!schemaContent.includes('url      = env("DATABASE_URL")')) {
                        schemaContent = schemaContent.replace(/provider\s*=\s*".+"/g, `$&\\n  url      = env("DATABASE_URL")`);
                        fs.writeFileSync(schemaPath, schemaContent);
                    }
                }
                
                // Cleanup canary config
                const prismaConfigPath = path.join(targetPath, 'prisma.config.ts');
                if (fs.existsSync(prismaConfigPath)) {
                    fsExtra.removeSync(prismaConfigPath);
                }

                if (pkg.scripts) {
                    for (const key in pkg.scripts) {
                        pkg.scripts[key] = pkg.scripts[key]
                            .replace(/npx /g, 'bunx ')
                            .replace(/tsx watch /g, 'bun --watch ')
                            .replace(/tsx /g, 'bun ')
                            .replace(/node /g, 'bun ');
                    }
                }
                if (pkg.prisma && pkg.prisma.seed) {
                    pkg.prisma.seed = pkg.prisma.seed
                        .replace(/npx /g, 'bunx ')
                        .replace(/tsx watch /g, 'bun --watch ')
                        .replace(/tsx /g, 'bun ')
                        .replace(/node /g, 'bun ');
                }

                // Ubah Dockerfile jika diikutsertakan
                if (includeDocker !== false) {
                    const dockerfilePath = path.join(targetPath, 'Dockerfile');
                    if (fs.existsSync(dockerfilePath)) {
                        const bunDockerfile = `# -----------------------------
# Builder
# -----------------------------
FROM oven/bun:alpine AS builder
WORKDIR /app/express-api

COPY package.json bun.lock* ./
COPY prisma ./prisma

RUN bun install

COPY . .

RUN bun run build

# -----------------------------
# Deps (Production deps + Prisma generate)
# -----------------------------
FROM oven/bun:alpine AS deps
WORKDIR /app/express-api

COPY package.json bun.lock* ./
COPY prisma ./prisma

RUN bun install --production
RUN bunx prisma generate

# -----------------------------
# Runner
# -----------------------------
FROM oven/bun:alpine AS runner
WORKDIR /app/express-api

RUN apk add --no-cache openssl libstdc++ ca-certificates

ENV NODE_ENV=production
ENV PORT=6789
ENV CLIENT_URL=""
ENV BASE_URL=""
ENV SERVICE_NAME="express-service"

COPY --from=deps /app/express-api/node_modules ./node_modules
COPY --from=builder /app/express-api/dist ./dist
COPY --from=builder /app/express-api/prisma ./prisma

EXPOSE 6789

CMD ["bun", "dist/src/index.js"]
`;
                        fs.writeFileSync(dockerfilePath, bunDockerfile);
                    }
                }
            }

            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
        }

        // ✏️ Sesuaikan Database Engine di schema.prisma dan .env
        const schemaPath = path.join(targetPath, 'prisma', 'schema.prisma');
        if (fs.existsSync(schemaPath)) {
            let schemaContent = fs.readFileSync(schemaPath, 'utf-8');
            schemaContent = schemaContent.replace(/provider\s*=\s*"postgresql"/g, `provider = "${dbEngine}"`);
            fs.writeFileSync(schemaPath, schemaContent);
        }

        const envExamplePath = path.join(targetPath, '.env.example');
        const envPath = path.join(targetPath, '.env');
        const setEnvDb = (file: string) => {
            if (fs.existsSync(file)) {
                let envContent = fs.readFileSync(file, 'utf-8');
                let newUrl = 'postgresql://user:password@localhost:5432/mydb?schema=public';
                if (dbEngine === 'mysql') newUrl = 'mysql://user:password@localhost:3306/mydb';
                if (dbEngine === 'sqlite') newUrl = 'file:./dev.db';
                envContent = envContent.replace(/DATABASE_URL=".+"/g, `DATABASE_URL="${newUrl}"`);
                fs.writeFileSync(file, envContent);
            }
        };
        setEnvDb(envExamplePath);

        // Jika bukan postgres, kita kembali ke native Rust engine
        if (dbEngine !== 'postgresql') {
            const schemaPathCurrent = path.join(targetPath, 'prisma', 'schema.prisma');
            if (fs.existsSync(schemaPathCurrent)) {
                let schemaContentCurrent = fs.readFileSync(schemaPathCurrent, 'utf-8');
                if (!schemaContentCurrent.includes('url      = env("DATABASE_URL")')) {
                    schemaContentCurrent = schemaContentCurrent.replace(/provider\s*=\s*".+"/g, `$&\\n  url      = env("DATABASE_URL")`);
                    fs.writeFileSync(schemaPathCurrent, schemaContentCurrent);
                }
            }

            const prismaTsPath = path.join(targetPath, 'src', 'config', 'prisma.ts');
            if (fs.existsSync(prismaTsPath)) {
                const genericPrismaConfig = `import { PrismaClient } from "@prisma/client/index.js";\n\nconst prisma = new PrismaClient();\nexport default prisma;\n`;
                fs.writeFileSync(prismaTsPath, genericPrismaConfig);
            }
            
            // Hapus package spesifik postgres dari package.json (agar tidak men-trigger Prisma Edge Client)
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            if (pkg.dependencies['pg']) delete pkg.dependencies['pg'];
            if (pkg.dependencies['@prisma/adapter-pg']) delete pkg.dependencies['@prisma/adapter-pg'];
            if (pkg.devDependencies['@types/pg']) delete pkg.devDependencies['@types/pg'];
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

            // Menghapus prisma.config.ts karena memancing TypedSQL & Driver Adapters yang mem-force pemakaian Edge Client
            const prismaConfigPath = path.join(targetPath, 'prisma.config.ts');
            if (fs.existsSync(prismaConfigPath)) {
                fsExtra.removeSync(prismaConfigPath);
            }
        }

        // Buat file .env otomatis jika belum ada
        if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
            fs.copyFileSync(envExamplePath, envPath);
        }

        // ✏️ Sesuaikan Jest vs Bun Test di package.json
        if (useBunTest) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            if (pkg.scripts) {
                pkg.scripts.test = 'bun test';
                delete pkg.scripts['test:watch'];
                delete pkg.scripts['test:coverage'];
            }
            if (pkg.devDependencies) {
                delete pkg.devDependencies['jest'];
                delete pkg.devDependencies['@types/jest'];
                delete pkg.devDependencies['ts-jest'];
            }
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

            const jestConfigPath = path.join(targetPath, 'jest.config.js');
            if (fs.existsSync(jestConfigPath)) fsExtra.removeSync(jestConfigPath);
        }

        // 📝 Tambahkan ignore file yang tidak relevan dengan package manager
        const gitignorePath = path.join(targetPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            if (pkgManager === 'bun') {
                gitignoreContent += '\n# Unused lockfiles\npackage-lock.json\nyarn.lock\npnpm-lock.yaml\n';
            } else {
                gitignoreContent += '\n# Unused lockfiles\nbun.lockb\nbun.lock\nyarn.lock\npnpm-lock.yaml\n';
            }
            fs.writeFileSync(gitignorePath, gitignoreContent);
        }

        if (includeDocker !== false) {
            const dockerignorePath = path.join(targetPath, '.dockerignore');
            if (fs.existsSync(dockerignorePath)) {
                let dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf-8');
                if (pkgManager === 'bun') {
                    dockerignoreContent += '\npackage-lock.json\nyarn.lock\npnpm-lock.yaml\n';
                } else {
                    dockerignoreContent += '\nbun.lockb\nbun.lock\nyarn.lock\npnpm-lock.yaml\n';
                }
                fs.writeFileSync(dockerignorePath, dockerignoreContent);
            }
        }


        // ✏️ Swagger Setup
        if (addSwagger) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            pkg.dependencies = pkg.dependencies || {};
            pkg.dependencies['swagger-ui-express'] = '^5.0.0';
            pkg.dependencies['swagger-jsdoc'] = '^6.2.8';
            pkg.devDependencies = pkg.devDependencies || {};
            pkg.devDependencies['@types/swagger-ui-express'] = '^4.1.6';
            pkg.devDependencies['@types/swagger-jsdoc'] = '^6.0.3';
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

            const appTsPath = path.join(targetPath, 'src', 'app.ts');
            if (fs.existsSync(appTsPath)) {
                let appTs = fs.readFileSync(appTsPath, 'utf-8');
                const swaggerImport = `import swaggerUi from 'swagger-ui-express';\nimport swaggerJSDoc from 'swagger-jsdoc';\n`;
                const swaggerImplementation = `\nconst swaggerOptions = {\n    definition: {\n        openapi: '3.0.0',\n        info: { title: '${finalProjectName} API Documentation', version: '1.0.0' },\n        components: {\n            securitySchemes: {\n                bearerAuth: {\n                    type: 'http',\n                    scheme: 'bearer',\n                    bearerFormat: 'JWT',\n                },\n            },\n        },\n    },\n    apis: ['./src/routes/*.ts', './src/controller/*.ts'],\n};\nconst swaggerSpec = swaggerJSDoc(swaggerOptions);\napp.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));\n`;
                appTs = swaggerImport + appTs;
                appTs = appTs.replace('app.get("/",', swaggerImplementation + '\napp.get("/",');
                fs.writeFileSync(appTsPath, appTs);
            }
        }

        // ✏️ Pino Setup
        if (loggerChoice.includes('pino')) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            if (pkg.dependencies['winston']) delete pkg.dependencies['winston'];
            if (pkg.dependencies['winston-daily-rotate-file']) delete pkg.dependencies['winston-daily-rotate-file'];
            pkg.dependencies['pino'] = '^8.19.0';
            pkg.dependencies['pino-pretty'] = '^10.3.1';
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));

            const winstonPath = path.join(targetPath, 'src', 'utils', 'winston.logger.ts');
            if (fs.existsSync(winstonPath)) {
                const pinoLogger = `import pino from 'pino';\n\nconst logger = pino({\n    transport: {\n        target: 'pino-pretty',\n        options: { colorize: true }\n    }\n});\n\nconst frameworkLogger = {\n    ...logger,\n    serverStartup: (port: number, env: string) => logger.info(\`🚀 Server successfully started on port \${port}\`),\n    serverReady: (port: number, urls: string[]) => logger.info(\`🌐 Server accessible at \${urls.length} endpoint(s)\`),\n    frameworkInit: (component: string, status: string) => logger.info(\`⚙️ Framework \${component} \${status}\`),\n    database: (action: string) => logger.info(\`🗄️ Database \${action}\`),\n    cache: (action: string) => logger.info(\`💾 Cache \${action}\`),\n    email: (action: string) => logger.info(\`📧 Email \${action}\`),\n    job: (action: string) => logger.info(\`⚡ Job \${action}\`),\n    request: (method: string, url: string, status: number, duration: number) => logger.info(\`\${method} \${url} \${status} - \${duration}ms\`),\n    health: (status: string) => logger.info(\` Health check \${status}\`),\n    security: (event: string) => logger.warn(\`🔐 Security event: \${event}\`)\n};\n\nexport default frameworkLogger;\n`;
                fs.writeFileSync(winstonPath, pinoLogger);
            }
        }

        // ✏️ PM2 Config
        if (addPm2) {
            const pm2Content = `module.exports = {\n  apps : [{\n    name   : "${finalProjectName}",\n    script : "./dist/src/index.js",\n    instances : "max",\n    exec_mode : "cluster",\n    env: {\n      NODE_ENV: "development"\n    },\n    env_production: {\n      NODE_ENV: "production"\n    }\n  }]\n};`;
            fs.writeFileSync(path.join(targetPath, 'ecosystem.config.js'), pm2Content);
        }

        // ✏️ GitHub Actions Config
        if (addCi) {
            const githubDir = path.join(targetPath, '.github', 'workflows');
            fsExtra.ensureDirSync(githubDir);
            const ciContent = `name: Node.js CI\n\non:\n  push:\n    branches: [ "main", "master" ]\n  pull_request:\n    branches: [ "main", "master" ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v3\n    - name: Setup Environment\n      uses: ${pkgManager === 'bun' ? 'oven-sh/setup-bun@v1' : 'actions/setup-node@v3'}\n      ${pkgManager === 'bun' ? 'with:\n        bun-version: latest' : 'with:\n        node-version: 20'}\n    - run: ${pkgManager === 'bun' ? 'bun install' : 'npm ci'}\n    - run: ${pkgManager === 'bun' ? 'bun run build' : 'npm run build'}\n`;
            fs.writeFileSync(path.join(githubDir, 'ci.yml'), ciContent);
        }


        // Jika user memilih TIDAK mengikutsertakan Docker, hapus file terkait
        if (includeDocker === false) {
            const dockerFiles = ['Dockerfile', 'docker-compose.yml', '.dockerignore', 'docker'];
            dockerFiles.forEach((f) => {
                const filePath = path.join(targetPath, f);
                if (fs.existsSync(filePath)) {
                    try {
                        fsExtra.removeSync(filePath);
                    } catch (err: any) {
                        console.warn(chalk.red(`Gagal menghapus ${f}: ${err.message || err}`));
                    }
                }
            });
        }

        const fileNotIncludeToCopy = ['README.md', 'LICENSE', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'];

        fileNotIncludeToCopy.forEach((file) => {
            const filePath = path.join(targetPath, file);

            if (fs.existsSync(filePath)) {
                try {
                    fsExtra.removeSync(filePath)
                } catch (error) {
                }
            }
        })

        if (installDeps) {
            console.log(chalk.blue(`📦 Menginstall dependencies menggunakan ${pkgManager}...`));
            if (pkgManager === 'bun') {
                execSync('bun install', { cwd: targetPath, stdio: 'inherit' });
            } else {
                execSync('npm install', { cwd: targetPath, stdio: 'inherit' });
            }
        } else {
            console.log(chalk.yellow(`\n⚠️  Melewati instalasi dependencies. Anda dapat menjalankan '${pkgManager} install' nanti.`));
        }

        if (initGit) {
            console.log(chalk.blue('⚙️  Menginisialisasi Git repository...'));
            try {
                execSync('git init', { cwd: targetPath, stdio: 'ignore' });
                execSync('git add .', { cwd: targetPath, stdio: 'ignore' });
                execSync('git commit -m "Initial commit"', { cwd: targetPath, stdio: 'ignore' });
            } catch (err) {
                console.warn(chalk.yellow('⚠️ Gagal menginisialisasi Git otomatis.'));
            }
        }

        console.log(chalk.green('\n✅ Project berhasil dibuat!'));
        console.log(chalk.cyan(`\n  cd ${isCurrentDir ? '.' : finalProjectName}\n  ${pkgManager} run dev\n`));
    } else {
        console.log(chalk.red('❌ Perintah tidak dikenali. Gunakan:'));
        console.log(chalk.cyan('   npx install-express create <nama-project> [--include-docker | --exclude-docker]'));
        console.log(chalk.cyan('   npx install-express create . (untuk folder saat ini)'));
    }
}

main();

