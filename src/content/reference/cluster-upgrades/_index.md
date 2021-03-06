---
title: "Cluster Upgrades with Giant Swarm"
description: "A detailed explanation how Kubernetes and other components are upgraded in a Giant Swarm installation"
date: 2020-05-05
weight: 30
layout: "subsection"
---

# Cluster Upgrades with Giant Swarm

A tenant cluster in a Giant Swarm installation is running a stack comprising many software components, provided by the Kubernetes project and other open source projects or software vendors, as well as by Giant Swarm.
In order to keep all components up-to-date, to allow you to benefit from latest improvements, features and security fixes, we provide upgrades for the entire software stack in tenant clusters.

At Giant Swarm we believe that frequent, small updates are a way to keep change in the system manageable.
We invest a lot of effort in making this happen without disrupting your usage of your clusters.

In this article, we explain how upgrades work in detail and how you should provide your workloads in order to keep them running during a tenant cluster upgrade and prevent disruptions of your applications.

## Background and Concepts

### The tenant cluster stack

Among the third party components building a tenant cluster stack are

- [Kubernetes](https://kubernetes.io/) with its many sub-components
- [Flatcar Container Linux](https://docs.flatcar-linux.org/) as the node's operating system
- [Docker](https://docs.docker.com/engine/) as a container runtime environment
- [etcd](https://coreos.com/etcd/) as distributed storage for Kubernetes and Vault
- [Project Calico](https://www.projectcalico.org/) and [AWS CNI](https://github.com/aws/amazon-vpc-cni-k8s)/[Azure CNI](https://github.com/Azure/azure-container-networking)/[Flannel](https://github.com/coreos/flannel) for virtual networking
- [CoreDNS](https://coredns.io/) for cluster-internal name resolution
- [Prometheus node exporter](https://github.com/prometheus/node_exporter) for hardware and OS metrics
- [NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx) for connecting services with load balancers

as well as many operators and controllers created and maintained by Giant Swarm.

### Releases

All of the items in the list above are released independent of each other by their vendors.
At Giant Swarm we bundle specific versions of these components of the tenant cluster stack into a **release**.
A release is identified by a [semantic version number](https://semver.org/).

Once deployed, the tenant cluster stack is **immutable**.
All components are deployed based on images, either of virtual machines or of Docker containers.
No changes are ever made to components at runtime.
This ensures that the stack running in your environment is the exact stack we have tested before.

As a consequence, the only way to change the stack is to perform an upgrade, to switch to a new release.

#### Release upgrade semantics

As the semantic versioning system defines, an upgrade from one version to another is either one of these:

- *Patch*: The smallest type of upgrade occurs when we publish bug-fixes, security fixes, or make changes to the observability while maintaining the given functionality of the stack.
This can include any sort of patch upgrades of third party components.

- *Minor*: A minor upgrade occurs when we add functionality, while maintaining the functionality of the stack as it was in the previous version.
This can include minor upgrades of third party components, with the exception of Kubernetes.

- *Major*: A major upgrade occurs when (A) a minor Kubernetes version upgrade is picked up (e. g. from 1.10.x to 1.11.x) or (B) we remove functionality or change functionality that might require changes in workloads, in automation working with the cluster or in administrator's interactions.

**Note:** The release version number is provider-specific.
Azure, AWS, and KVM based installations have independent versioning systems, as their stacks are also slightly different.

We have a [reference page with an overview of our release versions](/reference/release-versions/), which can give you an idea of what release versions are currently available and what notable features they support.

### Determining the release version and inspecting release details

As a user with access to the Giant Swarm API, and being a member of the organization owning the cluster, you can use either the web UI or the CLI to find out the current release version of your tenant cluster.

In the web UI, both the cluster overview and the cluster details page show the release version number.
In the cluster details page you can click the release version number to get more information about a release.

Likewise in the CLI, commands like [`gsctl list clusters`](/reference/gsctl/list-clusters/) and [`gsctl show cluster`](/reference/gsctl/show-cluster/) reveal the release version number.
To get information on all available releases, use the [`gsctl list releases`](/reference/gsctl/list-releases/) command.

### Upgrade a cluster

As an authenticated user you can upgrade the cluster version using the web UI or the CLI. The web UI shows a yellow link next to the version information if there is an upgrade available. For the CLI you can use the command [`gsctl upgrade cluster`](/reference/gsctl/upgrade-cluster/) for the same purpose.

When the upgrade process is managed by our tools the release version chose is selected by Giant Swarm according to best practices. It means it will not upgrade a cluster by more than one major version at a time. In case you use the raw API to upgrade your cluster please test the process against a non-production cluster first.

#### Cluster Upgrade Checklist

Before triggering the upgrade, there are some checks we encourage you to perform:

- Verify all your important pods are running correctly, and there are no deployments stuck because of failures.

```nohighlight
kubectl get pod --all-namespaces | grep -v "Running\|ContainerCreating"
```

- In case there is a validation or mutation webhook configured you should check there is a [timeout](https://github.com/kubernetes/kubernetes/issues/71508#issuecomment-470315405) configured correctly to not break the upgrade process. We recommend using low timeouts for the webhooks resources.

```yaml
apiVersion: admissionregistration.k8s.io/v1beta1
kind: ValidatingWebhookConfiguration
metadata:
  name: <name of this configuration object>
webhooks:
- name: <webhook name>
  ...
  timeoutSeconds: 5
```

__Warning:__ If your Kubernetes version is prior to `1.14.x` we advise you to delete the validation or mutation webhooks instead of configuring a timeout (it was introduced in the latest version).

At the same time we advise to read upfront these [recommendations](#recommendations).

### Release lifecycle

**We hold two different major releases** available at any time to chose from when creating a new cluster, which means that you have two different Kubernetes minor versions to chose from.

Whenever a new Kubernetes minor version is released by the Kubernetes project, we aim to make that version available in a new major release of our stack within 30 days from the Kubernetes release.

Once we publish a new major release, we deprecate the oldest major release.
This means that no new clusters can be created using that old release version.
Existing clusters, however, are not affected.

**Both patch and minor upgrades** can be rolled out at any time by Giant Swarm without your interaction. Currently, this happens in coordination with your administrators and with a notice to your developers.

When a **new major Giant Swarm release** becomes available, we inform you, but leave scheduling of the upgrade to you. This gives you the control to decide if and when it is time for you to upgrade, potentially updating workloads first. These upgrades are also accompanied or even triggered by Giant Swarm staff, to ensure we have a close eye on the upgrade process and the uptime of your workloads.

Every new minor Kubernetes release, which comes with a major Giant Swarm release, is tested for conformance using the CNCF [conformance test suite](https://github.com/cncf/k8s-conformance).
In addition, every release, from patch to major, undergoes automated integration testing.

## How upgrades work

All levels of upgrades, patch, minor, or major, are happening at runtime.
Your Kubernetes workloads should continue to work as expected (given they meet a few requirements, as explained further below).

In particular this means:

- Nodes will be drained, then stopped, then recreated.
- As a consequence of draining, Pods running on a node will be rescheduled to other nodes.
- Once the master node is taken down and recreated, the Kubernetes API will be unavailable for a short time.

**Note**: Currently tenant clusters have one master node each. We have plans on our roadmap to allow for multiple master nodes, keeping the Kubernetes API accessible during an upgrade and increasing the resilience in case of a machine failure.

### Provider-specific details for AWS

AWS resources are managed by the [aws-operator](https://github.com/giantswarm/aws-operator) component through a nested CloudFormation stack. For a tenant cluster upgrade, the CloudFormation stacks are updated, in several steps.

The master node re-creation is started first. Meanwhile, the recreation of worker nodes starts, where all worker nodes are recreated in batches. During the upgrade, **up to 33 percent of the worker nodes can be unavailable**.

After recreation, worker nodes are **not expected to have the same names** they had before.

In process of the worker node recreation, any data stored in worker node's local storage, i. e. outside of EBS volumes, is lost.

**Note:** We are in the process of making upgrades on AWS less disruptive.
One goal is to make new nodes available first, then drain and remove old nodes. Also we are aware that for larger clusters, one thirds of worker nodes becoming unavailable at the same time is often too much.

### Provider-specific details for Azure

Our [azure-operator](https://github.com/giantswarm/azure-operator) manages tenant clusters on Azure via Azure Resource Manager (ARM) templates and Virtual Machine Scale Sets (VMSS).

In an upgrade, all Virtual Machines (VM) are updated by reimaging with a new OS image and then rebooting.
Master and worker nodes are updated one by one, where each node is first drained (Pods re-scheduled to other nodes) and then reimaged and rebooted.

On Azure, the node names visible to Kubernetes (e. g. `kubectl get nodes`) are not changed in an upgrade.

**Note:** Any local storage in the node is erased. Persistent volumes are not affected by that.

### Provider-specific details for KVM

In a KVM-based cluster, our [kvm-operator](https://github.com/giantswarm/kvm-operator) builds each tenant cluster node out of a Kubernetes Deployment and Pod in the control plane.
In an upgrade, each of these deployments is updated after the according node has been drained, one after another, starting with the master node.
This leads to removal and recreation of the Pods.

## How to prepare your workloads {#recommendations}

The following recommendations should help you harden your workload deployments for a typical upgrade process. Furthermore, they also make your workloads more resilient against unpredicted failures, high load, and resource pressure in your cluster.

### Scale up and distribute workloads

Make sure you have 2 or more replicas for all your deployments. For critical components you might want to go with more than just the bare minimum of 2.

You can adjust this depending on your environments, e.g. running 2-3 replicas in `DEV`, and 5 or more in `PROD`.

In case you are using Horizontal Pod Autoscaler, above recommendations should depict your minimum replica setting.

Additionally, you should make sure your replicas do not land on the same node using [inter-pod anti-affinity](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#inter-pod-affinity-and-anti-affinity-beta-feature).

We recommend always using soft anti-affinity to avoid exclusivity of nodes. However, this can, in cases, lead to less distributed workloads on resource pressure or node failure, which will need a rescheduling to be balanced again.

For such rescheduling or rebalancing you should have a look at the incubation project called [descheduler](https://github.com/kubernetes-incubator/descheduler) and evaluate its use in your clusters. It has settings for avoiding affinities, but also for rebalancing clusters with under-utilized nodes.

### Manage disruption budgets

Configure [PodDisruptionBudgets](https://kubernetes.io/docs/tasks/run-application/configure-pdb/) for all your deployments. This tells Kubernetes to keep a minimum amount of Pods running at all times and is respected by the draining/eviction mechanisms during upgrades.

### Make rescheduling graceful

To make rescheduling during upgrades of both the cluster as well as your own deployments more graceful you should take care of a few settings on your Pods. However, these settings might not be enough, your application must be able to handle standard termination signals and have a procedure for gracefully shutting down. Further, it needs to expose some sort of liveness and/or readiness endpoints for Kubernetes to be able to probe it.

1. Have well implemented [liveness and readiness probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/). Often, a container being alive does not mean it is ready to receive traffic. By differentiating between liveness and readiness you can not only control when traffic gets routed to a fresh container, you can also influence graceful termination of your container.
2. Set proper values for `initialDelaySeconds` (related to previous point).
3. Set proper values for `terminationGracePeriod` to give your Pod time to gracefully shut down.

### Set scheduling priorities

Consider using Pod priority to ensure that higher priority Pods are scheduled favorably in times of resource pressure.

We recommend reading the upstream documentation about [priority classes and pod preemption](https://kubernetes.io/docs/concepts/configuration/pod-priority-preemption/) to get a better understanding of how the scheduler works with these.

To help the scheduler further with being able to correctly (re-)schedule your Pods, you should [set resource request and limits](https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/). This also sets the Quality of Service of a Pod, which again has influence on scheduling priorities.

### Avoid ephemeral resources

In Kubernetes it is possible to schedule ephemeral resources.

For example a Pod by itself, i.e. without a Deployment, DaemonSet, StatefulSet, etc., is an ephemeral resource that will not be rescheduled when it dies or gets killed. A Pod definition should thus only be used for use cases like debugging or quick manual tests. Be sure to always use a controller-managed resource for your containers.

Furthermore, local storage in form of `emptyDir` is also ephemeral, and should not be used to persist data. It should only be used as a cache or temporary storage that you can live without in case of failure or rescheduling. In most cases this is also true of `hostPath` as the local storage of a new node might not be the same as the one of the old node.

### General Container Hygiene

There's additional general container hygiene recommendations that will help smoothen the upgrade process.

As container images might not be already available on the new node that the Pod gets rescheduled to you should make sure that all container images (and tags) that you are using are available in the registry that is configured for the Pods.

Furthermore, you should make your containers as light (in terms of size) as possible to make the image pulling and with that the rescheduling process faster.
