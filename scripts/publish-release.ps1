$ErrorActionPreference = 'Stop'

$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
if ($env:RELEASE_TAG -ne "v$version") { throw 'Tag must match package version' }
if ($env:GITHUB_REPOSITORY -ne 'haipengTian/normal-desk') { throw 'Unexpected release repository' }
$notes = "docs/releases/v$version.md"
if (-not (Test-Path -LiteralPath $notes -PathType Leaf)) { throw "Missing release notes: $notes" }

$json = gh release view $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --json isDraft,assets
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect draft release' }
$release = $json | ConvertFrom-Json
foreach ($name in @('Desktop-Starter-Setup.exe', 'Desktop-Starter-Setup.exe.blockmap', 'latest.yml')) {
    $asset = @($release.assets | Where-Object { $_.name -eq $name -and $_.size -gt 0 })
    if ($asset.Count -ne 1) { throw "Missing release asset: $name" }
}
if ($release.isDraft) {
    gh release edit $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --draft=false --prerelease=false --latest --notes-file $notes
    if ($LASTEXITCODE -ne 0) { throw 'Could not publish release' }
    Write-Output "Published $env:RELEASE_TAG"
} else {
    Write-Output "$env:RELEASE_TAG is already published with all required assets"
}
