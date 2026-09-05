<#
用法：在项目根目录执行  .\pack.ps1，即可发起 Android 云打包。
证书与密码从 pack.local.json 读取（该文件已加入 .gitignore，不进仓库）。
#>
param(
	[string]$ConfigFile = "pack.local.json"
)

$ErrorActionPreference = 'Stop'

$cfgPath = Join-Path (Get-Location) $ConfigFile
if (-not (Test-Path $cfgPath)) {
	throw "未找到打包配置：$cfgPath"
}

$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

if (-not $cfg.hbuilderxCli -or -not (Test-Path $cfg.hbuilderxCli)) {
	throw "hbuilderxCLI 路径无效：$($cfg.hbuilderxCli)"
}

$env:HBUILDERX_CLI_PATH = $cfg.hbuilderxCli

& $cfg.hbuilderxCli pack `
	--project $cfg.project `
	--platform android `
	--android.packagename $cfg.packageName `
	--android.androidpacktype 0 `
	--android.certalias $cfg.certAlias `
	--android.certfile $cfg.certFile `
	--android.certpassword $cfg.certPassword `
	--android.storepassword $cfg.storePassword
