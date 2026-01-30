# feat(node-unit): support claim policy 'none' and 'daemon' deployment type

## What

- Implemented `NODE_UNIT_CLAIM_POLICY=none` to disable the scheduler's claim/assign logic.
- Introduced `deployment.type` field (`daemon` vs `deployment`).
  - `daemon`: Runs on every node unit, no address binding.
  - `deployment`: Classic behavior, binds to a specific node address.

## Why

- To support scenarios where node units should strictly run local workloads without participating in the cluster-wide claim process.
- To natively support "DaemonSet" like behavior (running an agent on every node) without manually creating duplicate deployment records.

## How

- Modified `apps/node-unit/src/scheduler.ts` to respect the `none` policy and filter out `daemon` types from the claiming process.
- Updated `apps/node-unit/src/index.ts` to execute `daemon` deployments locally regardless of address binding.
- Updated `ui/web/src/modules/Deploy/DeploySettings.tsx` to support type selection and address field toggling.
- Updated SQL schema and `IDeployment` interface.

## Testing

- **Unit Tests**: **PASS** (28 tests passed).
  - Suite: `apps/node-unit/src/scheduler.test.ts`
  - Covered policy selection, daemon filtering, and error handling.
- **Verification**: Verified that `none` policy logs `DeploymentClaimSkipped` and does not update DB addresses.

## Risk & Rollback

- **Risk**: Old versions of `node-unit` might incorrectly claim `daemon` records.
- **Mitigation**: **Do not enable** any `daemon` type deployments until all `node-unit` instances are upgraded.
- **Rollback**: Disable `daemon` records, then revert code.

## Links

- [Walkthrough Report](report-walkthrough.md)
- [RFC](rfc-node-unit-claim-policy.md)
