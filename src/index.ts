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

        // ✏️ Ubah package.json → name
        const pkgJsonPath = path.join(targetPath, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            pkg.name = finalProjectName;
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
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

        const fileNotIncludeToCopy = ['README.md', 'LICENSE']

        fileNotIncludeToCopy.forEach((file) => {
            const filePath = path.join(targetPath, file);

            if (fs.existsSync(filePath)) {
                try {
                    fsExtra.removeSync(filePath)
                } catch (error) {
                }
            }
        })

        console.log(chalk.blue('📦 Menginstall dependencies...'));
        execSync('npm install', { cwd: targetPath, stdio: 'inherit' });

        console.log(chalk.green('\n✅ Project berhasil dibuat!'));
        console.log(chalk.cyan(`\n  cd ${isCurrentDir ? '.' : finalProjectName}\n  npm run dev\n`));
    } else {
        console.log(chalk.red('❌ Perintah tidak dikenali. Gunakan:'));
        console.log(chalk.cyan('   npx install-express create <nama-project> [--include-docker | --exclude-docker]'));
        console.log(chalk.cyan('   npx install-express create . (untuk folder saat ini)'));
    }
}

main();

