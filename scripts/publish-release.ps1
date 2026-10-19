param([string]$ArtifactDirectory = 'release/current')
$ErrorActionPreference = 'Stop'

$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
if ($env:RELEASE_TAG -ne "v$version") { throw 'Tag must match package version' }
if ($env:GITHUB_REPOSITORY -ne 'haipengTian/normal-desk') { throw 'Unexpected release repository' }
$notes = "docs/releases/v$version.md"
if (-not (Test-Path -LiteralPath $notes -PathType Leaf)) { throw "Missing release notes: $notes" }
$names = @('Desktop-Starter-Setup.exe', 'Desktop-Starter-Setup.exe.blockmap', 'latest.yml')

$json = gh release list --repo $env:GITHUB_REPOSITORY --limit 100 --json tagName,isDraft
if ($LASTEXITCODE -ne 0) { throw 'Could not list releases' }
$existing = @($json | ConvertFrom-Json | Where-Object { $_.tagName -eq $env:RELEASE_TAG })
$published = @($existing | Where-Object { -not $_.isDraft }).Count -gt 0
if (-not $published) {
    $files = @($names | ForEach-Object {
        $file = Join-Path $ArtifactDirectory $_
        if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -eq 0) {
            throw "Missing local release asset: $file"
        }
        $file
    })
    if ($existing.Count -eq 0) {
        gh release create $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --verify-tag --draft --title "Desktop Starter v$version" --notes-file $notes
        if ($LASTEXITCODE -ne 0) { throw 'Could not create draft release' }
    }
    # Upload the three files from the same build in one command. Never replace published assets.
    gh release upload $env:RELEASE_TAG @files --repo $env:GITHUB_REPOSITORY --clobber
    if ($LASTEXITCODE -ne 0) { throw 'Could not upload release assets' }
}

$json = gh release view $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --json isDraft,assets
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect release assets' }
$release = $json | ConvertFrom-Json
foreach ($name in $names) {
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
