; NSIS uses InstallDir's final component as the Browse dialog suffix, and
; avoids appending it if the selected folder already has that name.
; electron-builder's initMultiUser still restores the real install location
; from the registry (or its normal default); do not reset $INSTDIR at runtime.
!macro customHeader
  InstallDir "$LOCALAPPDATA\Programs\${APP_FILENAME}"
!macroend
