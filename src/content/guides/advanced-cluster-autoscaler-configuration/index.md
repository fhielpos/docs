---
title: Advanced Cluster Autoscaler Configuration
description: Here we describe how you can customize the configuration of the managed Cluster Autoscaler service in your clusters
date: 2020-07-01
type: page
weight: 40
tags: ["tutorial"]
---

# Advanced Cluster Autoscaler Configuration

Your Giant Swarm installation comes with a default configuration for the [Cluster Autoscaler addon](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler)

You can override these defaults in a ConfigMap named `cluster-autoscaler-user-values`.

## Where is the user values ConfigMap

The location of the user values ConfigMap depends on the cluster's release version.
The following examples assume the cluster you are trying to configure has an id of `123ab`

### Release version 9.0.1 and greater {#find-uservalues-9plus}

If your cluster is on release version `9.0.1` or greater then you will find the `cluster-autoscaler-user-values` ConfigMap on the Control Plane in the `123ab` namespace:

```nohighlight
$ kubectl -n 123ab get cm cluster-autoscaler-user-values --context=control-plane
NAME                                   DATA      AGE
cluster-autoscaler-user-values         0         11m
```

Upgrading from `9.0.0` to a higher release will automatically migrate these user values from the Tenant Cluster to the
Control Plane for you. If you have any automation or existing workflows you should keep this location change in mind.

### Release version 9.0.0 and below {#find-uservalues-before9}

If the cluster has a release version equal to `9.0.0` or lower, then you will find the `cluster-autoscaler-user-values` ConfigMap on the Tenant Cluster itself in the `kube-system` namespace:

```nohighlight
$ kubectl -n kube-system get cm cluster-autoscaler-user-values --context=tenant-cluster
NAME                                   DATA      AGE
cluster-autoscaler-user-values         0         11m
```

-----

__Warning:__

Please do not edit any other cluster autoscaler related ConfigMaps.

Only the user values ConfigMap is safe to edit.

-----

On cluster creation the user values ConfigMap is empty (or might not exist yet) and the following defaults will be applied to the final Cluster Autoscaler deployment. To customize any of the configuration options, you just need to add the respective line(s) in the data field of the user ConfigMap.

## How to set configuration options using the user values ConfigMap

### Release version 9.0.1 and greater {#config-uservalues-9plus}

On the Control Plane, create or edit a ConfigMap named `cluster-autoscaler-user-values`
in the Tenant Cluster namespace:

```yaml
# On the Control Plane, in the abc12 namespace

apiVersion: v1
kind: ConfigMap
metadata:
  labels:
    app: cluster-autoscaler
  name: cluster-autoscaler-user-values
  namespace: abc12
data:
  values: |
    configmap:
      scaleDownUtilizationThreshold: 0.30
```

### Release version 9.0.0 and below {#config-uservalues-before9}

On the Tenant Cluster for which you are trying to configure cluster-autoscaler,
create or edit a ConfigMap named `cluster-autoscaler-user-values` in the `kube-system`
namespace:

```yaml
# On the Tenant Cluster, in the kube-system namespace

apiVersion: v1
kind: ConfigMap
metadata:
  labels:
    app: cluster-autoscaler
  name: cluster-autoscaler-user-values
  namespace: kube-system
data:
  scaleDownUtilizationThreshold: 0.30
```

## Configuration Reference

The following sections explain some of the configuration options and what their
defaults are. They show only the 'data' field of the ConfigMap for brevity.

The most recent source of truth for these values can be found in
the [values.yaml](https://github.com/giantswarm/cluster-autoscaler-app/blob/v1.1.4/helm/cluster-autoscaler-app/values.yaml) file of the cluster-autoscaler-app

### Scale down utilization threshold

The `scaleDownUtilizationThreshold` defines the proportion between requested resources and capacity, which under the value Cluster Autoscaler will trigger the scaling down action.

Our default value is 65%, which means in order to scale down, one of the nodes has to have less utilization (CPU/memory) than this threshold.

```yaml
# 9.0.1 and greater
data:
  values: |
    configmap:
      scaleDownUtilizationThreshold: 0.65

# 9.0.0 and below
data:
  scaleDownUtilizationThreshold: 0.65
```

### Scan Interval

Define what interval is used to review the state for taking a decision to scale up/down. Our default value is 10 seconds.

```yaml
# 9.0.1 and greater
data:
  values: |
    configmap:
      scanInterval: "100s"

# 9.0.0 and below
data:
  scanInterval: "100s"
```

### Skip system pods

By default, the Cluster Autoscaler will never delete nodes which run pods of the `kube-system` namespace (except `daemonset` pods). It can be modified by setting following property to `"false"`.

```yaml
# 9.0.1 and greater
data:
  values: |
    configmap:
      skipNodesWithSystemPods: "false"

# 9.0.0 and below
data:
  skipNodesWithSystemPods: "false"
```

### Skip pods with local storage

The Cluster Autoscaler configuration by default deletes nodes with pods using local storage (`hostPath` or `emptyDir`). In case you want to disable this action, you need to set the following property to `"true"`.

```yaml
# 9.0.1 and greater
data:
  values: |
    configmap:
      skipNodesWithLocalStorage: "true"

# 9.0.0 and below
data:
  skipNodesWithLocalStorage: "true"
```

## Further reading

- [Cluster Autoscaler Github repository](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler)
- [Kubernetes autoscaler FAQ](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md)
