# Release Guide (Maintainer)

이 문서는 cloud-native-devkit(local-dev) 실행파일을 만들어 GitHub Release로 배포하는 절차를 정리합니다.
(사용자 README에는 포함하지 않습니다.)

## 0) 전제
- main 브랜치 최신화
- 로컬에서 `npm i` 가능 상태

## 1) 버전 올리기
- (예시) package.json 버전 수정
- 커밋/태그 생성

```bash
git checkout main
git pull

# 버전 수정 후
git add package.json
git commit -m "chore(release): v0.1.0"
git tag v0.1.0
git push origin main --tags
````

## 2) 실행파일 빌드

* OS별로 빌드하는 것을 권장 (Windows exe는 Windows에서)

### macOS / Linux

```bash
npm i
npm --workspace packages/core run build
npm --workspace packages/cli run build
npm run package
```

### Windows (PowerShell)

```powershell
npm i
npm --workspace packages/core run build
npm --workspace packages/cli run build
npm run package
```

## 3) GitHub Release 업로드

* GitHub > Releases > Draft a new release
* Tag: `v0.1.0`
* `dist/` 산출물을 업로드

  * macOS: local-dev-darwin-*
  * Windows: local-dev-win-*.exe
  * Linux: local-dev-linux-*

## 4) 검증

* 새 머신에서 실행 확인

```bash
local-dev --help
local-dev doctor
```
