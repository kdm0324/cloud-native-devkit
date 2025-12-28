### A) k3d (Docker/Colima 기반)

#### 1) (선택) 현재 port-forward 백그라운드 중지

```bash
npm run dev:cli -- forward stop
```

#### 2) (선택) 인프라 내리기(Helm uninstall)

```bash
npm run dev:cli -- down
```

#### 3) k8s 클러스터 내리기(삭제)

```bash
k3d cluster delete localdev
```

#### 4) (선택) Docker/Colima까지 내리기

```bash
colima stop
```

#### 5) (선택) Docker/Colima 다시 띄우기

```bash
colima start
```

#### 6) k8s 클러스터 생성

```bash
k3d cluster create localdev
kubectl config use-context k3d-localdev
kubectl get nodes
```

#### 7) CLI로 인프라 생성

```bash
npm run dev:cli -- doctor --env k3d --require-cluster
npm run dev:cli -- init
npm run dev:cli -- up
npm run dev:cli -- forward
```

---

### B) Rancher Desktop (GUI 기반 k3s)

#### 1) (선택) 현재 port-forward 백그라운드 중지

```bash
npm run dev:cli -- forward stop
```

#### 2) (선택) 인프라 내리기(Helm uninstall)

```bash
npm run dev:cli -- down
```

#### 3) Rancher Desktop에서 k8s 내리기

- Rancher Desktop 실행
- Settings → Kubernetes → **Disable/Stop**

#### 4) Rancher Desktop에서 k8s 다시 띄우기

- Settings → Kubernetes → **Enable/Start**

#### 5) kubectl 연결 확인

```bash
kubectl config get-contexts
kubectl get nodes
```

#### 6) 우리 CLI로 인프라 다시 띄우기

```bash
npm run dev:cli -- doctor --env rancher --require-cluster
npm run dev:cli -- up
npm run dev:cli -- forward
```
