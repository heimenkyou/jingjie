import subprocess
import os
import sys

# ================= 配置区域 =================
SSH_HOST = "luowb"
REMOTE_DIR = "/opt/1panel/www/sites/jingjie.luowb.cn/index"
ARCHIVE_NAME = "jingjie-dist.7z"
DIST_DIR = "dist"
# ============================================

def run_local():
    # 1. 构建项目
    print("开始构建项目...")
    subprocess.run("pnpm run build", shell=True, check=True)

    # 2. 打包
    print("正在打包 dist 目录...")
    if os.path.exists(ARCHIVE_NAME):
        os.remove(ARCHIVE_NAME)
    subprocess.run(f"7z a -y ../{ARCHIVE_NAME} .", shell=True, cwd=DIST_DIR, check=True)

    # 3. 上传
    print(f"正在上传到服务器 {SSH_HOST}...")
    subprocess.run(f"scp {ARCHIVE_NAME} {SSH_HOST}:/tmp/{ARCHIVE_NAME}", shell=True, check=True)

def run_remote():
    # 4. 执行远程部署
    print("正在服务器端执行部署...")

    commands = [
        f"sudo touch {REMOTE_DIR}/index.html",
        f"sudo rm -rf {REMOTE_DIR}/*",
        f"sudo 7z x /tmp/{ARCHIVE_NAME} -o{REMOTE_DIR} -y > /dev/null",
        f"rm -f /tmp/{ARCHIVE_NAME}"
    ]

    remote_cmd = " && ".join(commands)
    subprocess.run(f'ssh {SSH_HOST} "{remote_cmd}"', shell=True, check=True)

def cleanup():
    # 5. 清理本地临时文件
    if os.path.exists(ARCHIVE_NAME):
        os.remove(ARCHIVE_NAME)

if __name__ == "__main__":
    try:
        run_local()
        run_remote()
        cleanup()
        print("部署成功。")
    except subprocess.CalledProcessError as e:
        print(f"部署过程中出现错误: {e}")
        sys.exit(1)
