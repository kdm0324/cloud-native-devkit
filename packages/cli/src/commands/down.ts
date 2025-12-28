import { requireCluster } from "../lib/kube.js";
import { loadState } from "../lib/state.js";
import { helmUninstall } from "../lib/helm.js";

export const cmdDown = async () => {
  await requireCluster();

  const st = loadState();
  await helmUninstall(st.release, st.namespace);
};