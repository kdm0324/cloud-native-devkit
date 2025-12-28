# cloud-native-devkit (local-dev)

Kubernetes 로컬 개발환경에서 Redis/Kafka/MySQL/PostgreSQL/MongoDB 같은 인프라를 **선택 설치(Helm)** 하고, **port-forward**까지 지원하는 CLI입니다.

- repo/차트 버전은 코드에 하드코딩하지 않고 `localdev.config.yaml`로 관리
- CLI는 `kubectl + helm`만 사용 (특정 로컬 클러스터 툴에 종속되지 않음)
- 로컬 클러스터는 사용자가 선택
  - **k3d (CLI-only, 가벼움)**: Docker 기반
  - **Rancher Desktop (GUI, 쉬움)**: k3s 기반, containerd/nerdctl 선택 가능
- port-forward는
  - 기본: **포그라운드(Ctrl+C 종료)**
  - 옵션: **백그라운드(--bg) + status/stop 지원**

---

## 설치 (권장: GitHub Release에서 실행파일 다운로드)

1) 이 저장소의 **최신 릴리즈 페이지**로 이동합니다.  
- Latest: https://github.com/kdm0324/cloud-native-devkit/releases/latest
- All Releases: https://github.com/kdm0324/cloud-native-devkit/releases

2) 운영체제에 맞는 실행파일을 다운로드해서 PATH에 두거나, 원하는 폴더에서 실행합니다.

macOS/Linux:

```bash
./local-dev --help
./local-dev doctor
````

Windows (PowerShell):

```powershell
.\local-dev.exe --help
.\local-dev.exe doctor
```

> 개발 중이면 `local-dev` 대신 `npm run dev:cli --`를 사용하세요.

---

## Quick Start

### 1) 진단

```bash
local-dev doctor
```

클러스터 방식에 맞춰 추가 진단(선택):

```bash
local-dev doctor --env k3d
local-dev doctor --env rancher
```

클러스터 연결까지 필수로 체크(없으면 실패):

```bash
local-dev doctor --require-cluster
```

### 2) 생성(init) → 설치(up)

```bash
local-dev init
local-dev up
```

### 3) 로컬 접속(port-forward)

기본(포그라운드, Ctrl+C 종료):

```bash
local-dev forward
```

백그라운드 실행:

```bash
local-dev forward --bg
```

상태/종료:

```bash
local-dev forward status
local-dev forward stop
```

포트 충돌 시:

```bash
local-dev forward --map "redis=16379,kafka=19092,postgresql=15432"
```

일부만:

```bash
local-dev forward --bg --only "redis,postgresql"
```

---

## 로컬 클러스터 옵션 A: k3d (CLI-only, 가벼움)

k3d는 **Docker daemon**이 필요합니다.

### macOS (Docker Desktop 없이: Colima 추천)

```bash
brew install colima docker k3d kubectl helm
colima start

k3d cluster create localdev
kubectl config use-context k3d-localdev
kubectl get nodes
```

진단:

```bash
local-dev doctor --env k3d
```

---

## 로컬 클러스터 옵션 B: Rancher Desktop (GUI, 쉬움)

1. Rancher Desktop 설치/실행
2. Settings에서 **Kubernetes Enable(k3s)**
3. 확인:

```bash
kubectl config get-contexts
kubectl get nodes
```

진단:

```bash
local-dev doctor --env rancher
```

---

## 설정 파일: localdev.config.yaml

* Helm repo 목록(`helm.repos`)
* 인프라 컴포넌트별 차트/버전/기본 enabled
* 컴포넌트별 기본 서비스 포트(`ports`)

즉, **repo/차트 버전 변경은 코드 수정 없이 config만 수정**하면 됩니다.

---

## 명령어

* `doctor`

  * 필수 도구(helm/kubectl/config) + (선택) 클러스터 연결 상태 안내
  * `doctor --env k3d` : k3d 환경 체크(선택)
  * `doctor --env rancher` : Rancher Desktop 환경 체크(선택)
  * `doctor --require-cluster` : 클러스터 연결까지 필수로 체크(없으면 실패)

* `init` : 인프라 선택 → 파일 생성

* `generate` : 저장된 spec(`.infra/spec.json`) 기반으로 파일 재생성

* `up` : helm upgrade/install

* `down` : helm uninstall

* `info` : 선택된 인프라/서비스/다음 명령 안내

* `forward` : enabled 인프라 서비스 port-forward

  * `forward` : 포그라운드 실행(Ctrl+C 종료)
  * `forward --bg` : 백그라운드 실행 + PID 저장
  * `forward status` : 백그라운드 상태 출력
  * `forward stop` : 백그라운드 종료

---

## 생성되는 파일

* `.infra/spec.json` : init에서 선택한 설정 저장
* `charts/infra/Chart.yaml` : 의존성(차트) 정의(설정 기반 생성)
* `charts/infra/values.yaml` : 기본값(모두 OFF)
* `infra-values.yaml` : 실제 설치용 values (init 결과 반영)
* `.infra/forwards.json` : (옵션) `forward --bg` 실행 시 PID/포트포워딩 상태 저장

---

## 개발 실행(Workspace)

```bash
npm i
npm --workspace packages/core run build

npm run dev:cli -- doctor
npm run dev:cli -- init
npm run dev:cli -- up
npm run dev:cli -- forward
```

> 참고: npm workspace로 실행해도 생성 파일이 프로젝트 루트에 떨어지도록 `INIT_CWD` 기준으로 동작하도록 구성되어 있습니다.

---

## Troubleshooting

### Q. `kubectl config current-context`가 비어있어요

A. kubeconfig에 컨텍스트가 없는 상태입니다. 아래 중 하나를 선택하세요.

* k3d(가벼운 CLI): `local-dev doctor --env k3d` 안내대로 Docker/Colima 준비
* Rancher Desktop: Kubernetes Enable 후 `kubectl get nodes` 확인

### Q. `up` 실행 시 `Kubernetes API 연결 실패`가 떠요

A. kubectl이 바라보는 클러스터가 없습니다(컨텍스트 없음) 또는 클러스터가 실행 중이 아닙니다.

```bash
kubectl config get-contexts
kubectl get nodes
```

### Q. `forward`에서 service 매칭이 안돼요

A. namespace 서비스 목록과 선택된 spec를 확인해 주세요.

```bash
kubectl -n local-infra get svc -o wide
cat .infra/spec.json
```
