# AI_RUNBOOK — cloud-native-devkit

> 목적: AI(Codex/Gemini)가 이 레포에서 “작게, 안전하게, 검증 가능하게” PR을 만들도록 돕는 최소 실행 가이드.

---

## 0) 프로젝트 한 줄 요약

이 프로젝트는 Kubernetes 로컬 개발환경에서 Redis/Kafka/MySQL/PostgreSQL/MongoDB 같은 인프라를 Helm으로 선택 설치하고, port-forward까지 지원하는 CLI다.
- 설정/차트 버전은 코드 하드코딩이 아니라 `localdev.config.yaml`로 관리한다.
- CLI는 `kubectl + helm` 기반으로 동작한다.
- 사용자 로컬 클러스터는 k3d 또는 Rancher Desktop 등 자유롭게 선택한다.

---

## 1) 골든 룰 (필수)

### 1.1 범위
- **이슈/코멘트에 없는 기능은 추가하지 않는다.**
- PR 1개는 “작업 1개”만 한다. (큰 변경은 쪼개서 여러 PR)

### 1.2 보안/로그
- secrets / env var / 토큰을 출력하지 않는다.
- 디버그 로그는 최소화한다. (특히 인증정보, kubeconfig 경로, helm repo credential 등)

### 1.3 검증
- 아래 “검증 커맨드(고정)”를 반드시 실행하고,
- 실패하면: **커밋/푸시하지 말고** 실패 원인 + 다음 액션만 코멘트로 보고한다.

---

## 2) 검증 커맨드 (고정)

CI/AI가 “항상” 실행해야 하는 최소 검증:

```bash
npm i
npm --workspace packages/core run build
npm run dev:cli -- doctor
````

작업 성격에 따라 추가로 허용되는 커맨드(필요할 때만):

```bash
npm run dev:cli -- init
npm run dev:cli -- up
npm run dev:cli -- forward
```

---

## 3) 레포 구조를 파악하는 빠른 방법

AI는 작업 시작 전에 아래를 먼저 확인한다.

1. 루트 `package.json`에서 다음을 찾는다.

* workspaces 설정
* `dev:cli` 스크립트가 무엇을 실행하는지 (CLI 엔트리포인트 위치 힌트)

2. `packages/` 하위에서 CLI 패키지를 찾는다.

* 일반적으로 `packages/cli` 또는 유사한 이름일 가능성이 높다.
* CLI 엔트리포인트(예: `src/index.ts`, `src/main.ts`, `bin/*.ts`)를 찾는다.

3. CLI가 현재 어떤 이름으로 실행되는지 확인한다.

* README 기준 기본 실행 예시는 `local-dev ...` 형태다.
* 개발 중 실행은 `npm run dev:cli -- <command>` 형태로 사용한다.

---

## 4) “cnd 커맨드 노출(bin)” 작업 가이드 (핵심)

### 목표

* 사용자가 원하는 UX:

  * `cnd doctor`
  * `cnd init`
  * `cnd up`
  * `cnd forward`
* (가능하면) `npx <패키지> doctor`도 동작하게 한다.
* 개발 모드(`npm run dev:cli -- doctor`)는 계속 유지한다.

### 구현 체크리스트 (AI가 따라야 할 순서)

#### 4.1 npm 패키지의 실행파일(bin) 노출

* CLI 패키지의 `package.json`에 `bin` 필드를 설정한다.

  * 예:

    * `"bin": { "cnd": "dist/bin/cnd.js" }` 또는 `"bin": { "cnd": "dist/index.js" }`
* 빌드 결과물 경로(`dist/...`)와 실제 빌드 스크립트/tsconfig 출력 경로를 일치시킨다.

#### 4.2 실행 파일 shebang

* Node 실행 파일 최상단에 shebang이 필요하다:

  * `#!/usr/bin/env node`
* TypeScript 소스에 직접 넣기보다, 빌드 후 결과물에 포함되도록 구성하거나, 빌드 파이프라인에서 유지되게 한다.

#### 4.3 패키지 이름(npx) 고려

* `npx` 실행 UX는 패키지명에 좌우된다.

  * 예: 패키지명이 `cloud-native-devkit`이면 `npx cloud-native-devkit doctor`
  * 별칭을 원하면 패키지명/스코프 설계를 변경해야 할 수 있으므로, **요청 범위를 초과하면 변경하지 않는다.**
* 요청이 “npx도 되면 좋겠다” 정도라면:

  * 우선 `bin`만 제대로 노출해도 npx로 실행 가능해진다.
  * (예) `npx <package-name> doctor` 형태

#### 4.4 기존 로컬 실행(dev:cli) 유지

* 기존 `npm run dev:cli -- doctor` 흐름이 깨지지 않아야 한다.
* 가능한 한 “실제 커맨드 구현”은 공유하고, “진입점만 하나 더 추가”한다.

  * dev script와 bin entry가 같은 내부 함수/커맨드 파서를 호출하도록 구성하면 유지보수에 유리.

#### 4.5 문서 최소 업데이트

* README에 아래 정도만 추가/변경:

  * 설치(예): `npm i -g <package>` 후 `cnd doctor`
  * 또는 “개발 중이면 `npm run dev:cli --` 사용” 문장 유지
* 문서 변경은 **최소**로 한다. (요청이 문서 포함이 아니라면 1~2줄만)

---

## 5) PR 작성 규칙 (AI)

* 브랜치: `ai/<issue-number>-<short>`
* 커밋 메시지: `ai: <issue-number> <short title>`
* PR 본문에 반드시 포함:

  1. 무엇을 바꿨는지 요약
  2. 검증 커맨드 결과(성공/실패 + 핵심 로그 일부)
  3. 영향 범위(예: “dev:cli 영향 없음”)

---

## 6) 실패 시 보고 포맷 (AI)

검증 실패 시:

* **푸시/PR 생성하지 말고**

* 이슈(또는 PR 코멘트)에 아래를 남긴다.

* 실패 커맨드:

* 에러 로그 핵심(민감정보 제거):

* 원인 추정:

* 다음 액션 제안(1~3개):

---

## 7) 작업 우선순위 힌트

* CLI UX(`cnd ...`) > 내부 리팩토링
* 설정 파일 기반(`localdev.config.yaml`) 철학 유지
* kubectl/helm 의존성 유지 (새로운 클러스터 종속 툴 추가 금지)

---

## 8) 인간에게 질문해야 하는 경우(최소)

AI는 가능한 질문 없이 진행하되, 아래에 해당하면 `ai:needs-human` 라벨을 요청한다.

* “패키지명 변경 / 스코프 변경 / 배포 방식 변경”이 필요한데 요청 범위를 넘어설 때
* 빌드 산출물 경로가 불명확하고, 변경이 과도하게 커질 때
* Windows/macOS/Linux 동시 지원 이슈로 설계 결정이 필요한데 근거가 부족할 때
