# One-off script: regenerates the platform's PWA icons/favicon from the
# Saovia Food source logo. Not part of the build pipeline -- run manually
# whenever the source logo changes. Tenant assets (logo/cover uploaded by
# a restaurant) are untouched by this; those are Supabase Storage files,
# not part of this repo.
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\HP\Projects\pacha-flavors-connect"
$source = Join-Path $root "src\assets\saovia-food-logo.jpg"
# favicon.ico only: a tight crop of just the cloche/fork/flame/leaf mark (no
# ring, no wordmark) -- at real favicon sizes (16/32/48px) the full badge's
# "Saovia Food" text and tagline turn to mush, so the tab icon uses just the
# graphic mark instead. Larger PWA icons/apple-touch-icon keep the full
# badge below, where the text stays legible.
$faviconSource = Join-Path $root "src\assets\saovia-food-favicon-mark.png"
$iconsDir = Join-Path $root "public\icons"

function New-ResizedPng {
    param(
        [string]$SourcePath,
        [string]$OutPath,
        [int]$Size,
        [double]$Scale = 1.0
    )
    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $canvas = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)
    $drawSize = [int]($Size * $Scale)
    $offset = [int](($Size - $drawSize) / 2)
    $g.DrawImage($src, $offset, $offset, $drawSize, $drawSize)
    $canvas.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $canvas.Dispose()
    $src.Dispose()
}

# "any" purpose -- full-bleed, matches the source logo's own circular badge framing.
New-ResizedPng -SourcePath $source -OutPath (Join-Path $iconsDir "icon-192.png") -Size 192 -Scale 1.0
New-ResizedPng -SourcePath $source -OutPath (Join-Path $iconsDir "icon-512.png") -Size 512 -Scale 1.0

# "maskable" purpose -- OS may crop to a circle/squircle; scaled down with a
# safe-zone margin so the badge's own ring isn't clipped.
New-ResizedPng -SourcePath $source -OutPath (Join-Path $iconsDir "icon-192-maskable.png") -Size 192 -Scale 0.8
New-ResizedPng -SourcePath $source -OutPath (Join-Path $iconsDir "icon-512-maskable.png") -Size 512 -Scale 0.8

# Apple touch icon -- no transparency, Apple recommends 180x180.
New-ResizedPng -SourcePath $source -OutPath (Join-Path $iconsDir "apple-touch-icon.png") -Size 180 -Scale 1.0

# favicon.ico -- modern ICO format storing PNG-encoded frames per size
# (supported since Vista, universal in current browsers), built manually
# since .NET has no built-in multi-size ICO writer.
function Get-PngBytes {
    param([string]$SourcePath, [int]$Size)
    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $canvas = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($src, 0, 0, $Size, $Size)
    $ms = New-Object System.IO.MemoryStream
    $canvas.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $canvas.Dispose(); $src.Dispose()
    return $ms.ToArray()
}

$sizes = @(16, 32, 48)
$frames = $sizes | ForEach-Object { Get-PngBytes -SourcePath $faviconSource -Size $_ }

$icoPath = Join-Path $root "public\favicon.ico"
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header
$bw.Write([uint16]0)      # reserved
$bw.Write([uint16]1)      # type = icon
$bw.Write([uint16]$sizes.Count)

$headerSize = 6
$dirEntrySize = 16
$offset = $headerSize + ($dirEntrySize * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $frameBytes = $frames[$i]
    $w = if ($size -ge 256) { 0 } else { $size }
    $h = if ($size -ge 256) { 0 } else { $size }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)     # color count (0 = no palette)
    $bw.Write([byte]0)     # reserved
    $bw.Write([uint16]1)   # color planes
    $bw.Write([uint16]32)  # bits per pixel
    $bw.Write([uint32]$frameBytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $frameBytes.Length
}

foreach ($frameBytes in $frames) {
    $bw.Write($frameBytes)
}

$bw.Flush()
$bw.Close()
$fs.Close()

Write-Output "Done. Wrote icon-192.png, icon-512.png, icon-192-maskable.png, icon-512-maskable.png, apple-touch-icon.png, favicon.ico"
