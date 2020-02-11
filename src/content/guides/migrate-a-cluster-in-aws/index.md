+++
title = "Kubernetes Cluster Migration"
description = "This guide will expose different approaches to consider when you need to migrate a Kubernetes cluster."
date = "2020-01-20"
type = "page"
weight = 70
tags = ["tutorial"]
+++

# Kubernetes Cluster Migration

## Overview

There some occasions where we would like to move our applications from one environment to other. There could be a plenty of reasons, migration from on-premise to the cloud, migration to a different cloud, recovery strategy or a requirement imposed by the current platform (not upgradable between platform versions). Here we are focussing in the later, and more in special in a cluster migration in a Kubernetes platform, although I reckon some points will be valid for the other scenarios as well.

Giant Swarm most of the times offers upgrades in-place so customers don't need to spin up a new cluster to get access to the newer platform release. Instead, the nodes are roll out following the immutable principles as we describe [in this guide](upgrade link guide). But some times the clusters are not upgradable for different reasons like networking architecture changes or a break change in a component of the stack.

A good first step for a migration is a elaborate a detailed plan. As the scope of a migration can be quite huge, the best idea is to break down the operation in multiple steps. Taking first a small non critical service, that could comprehend multiple interconnected components, and moving it to the new cluster will be easier and give us confidence on the entire goal. 

There are some considerations to make when we are selecting a service for the migration. We must to think and answer questions like "Has the selected service got any dependency within the same cluster or external service? (like it needs to talk to an internal API)", "Is there any requisite needed to properly run the service in the newer cluster? (like it must run on a specific hardware)", "Is there any change or incompatibility in the newer cluster that can prevent the application to run correctly? (new API schema for a Kubernetes resource that may impact on the service)", ... Beyond these considerations, I would like to encourage at this point take advantage of an enhancement or feature offered in the new cluster stack (small steps, small failures). 

## Alternatives

Once we have agreed on the planing part, we need to select which tools and procedures will help us to succeed with the mission. Obviously is impossible to list all alternatives, especially because for each migration case there will be some exceptions or impediments that varies the plan design.

Here I list three options that can help us depend on the context and the maturity of our continuous delivery system. 

- As the first option, we could use the amazing tool [Velero](https://velero.io/), former Ark, created by Heptio. Although this tool is thought to be used as backup and restore solution, it opens the door to use as well for a cluster migration. If we need to migrate our application to a new cluster quick and dirty it would most likely the easiest solution. We would recommend it more for exploratory or testing use cases, where we can verify our application will run in the new cluster correctly. 

- As second possibility would be use [Kubernetes Federation](). Beside sequels have not always been successful, the second version of federation works pretty well and allows us to control our migration in detail. It could be not the main goal of cluster federation but definitively we could leverage on it to perform gradual application migration from one cluster to other.

- The most sophisticated way of migrating our application is to use a proper continues delivery platform. For example, using Spinnaker or Argo CD will help us to configure a new pipeline or stage in our deployment configuration that releases the application in the new target cluster. At the same time, they offer us a mechanism to redirect the traffic accordingly to have a finer grade control in case any failure appears. 

## Use Velero to backup and restore your application

This tool is formed by a command line tool (CLI) and an [operator](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/) running as a pod in your Kubernetes cluster. Once you have the installed the `velero` CLI, you can use directly to deploy the server into the clusters (source and target). 

Velero relies on [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/api-extension/custom-resources/#customresourcedefinitions) like `BackupStorageLocation`, `Backup` or `Restore` to configure and manage the flow of the backup and restore actions. Behind the scene, Velero stores a backup of the Kubernetes resources running in the cluster in a compress file on the cloud object storage defined at deployment time. Further, it uses the Cloud provider API to take snapshots of the volumes used for the workloads. Therefore, for the installation you need to pass Cloud credentials along with the object storage location.

```bash
velero install
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.0.0 \
    --bucket velero-fer \
    --backup-location-config region=eu-central-1 \
    --snapshot-location-config region=eu-central-1
```
__Note__: Example of how to install the Velero operator in the Kubernetes cluster configured on your shell. We must install Velero operator in both clusters, origin and target (both pointing to the same backup location).

Once we have ensured Velero is running properly on the cluster (please check the logs to confirm there are no errors), we are ready to take a snapshot of our application. Here we will take a backup of all resources running on the namespace `default`.

```bash
velero backup create migration --include-namespaces="default"
```

We can inspect the progress of the backup and check it has been completed successfully. 

```bash
velero backup describe migration
```

Once it is done, we can change the context of `kubectl` to point the target cluster. There we should be able to list the backups and see the new one. Both Velero operators point to the same backup location and it allows to sync backups in both places.

```bash
velero backup get
<INCLUDE OUTPUT OF COMMAND>
```

Now it is time to restore the application in the target cluster. The simple following command will make the trick.

```bash
velero restore create --from-backup migration
```

After the action is completed we can verify all the resources have been restored in the `default` namespace, and what is even more awesome, the persistent volumes have been cloned (only works within the same region). It could seem simple task but Velero under the hood is taking care that all nuances of the different types of resources are resolved. For example, it check endpoints IPs are correct or cluster role bindings used by our application are copied along the other namespaced resources.

This power comes with a responsibility, it means we need to test it carefully. There are applications or tools like [`external DNS`]() that could trigger undesired consequences when it is copied with its custom resources from one cluster to other. Be aware you can use labels to filter only the resources you want to copy even within a namespace.

We would insist that you take a look inside the compressed backup file in order to inspect which resources have been copied.

## Kubernetes Federation

As surprisingly as could appear Kubernetes federation can be used to perform upgrades. Indeed it is way easier and flexible compared to use a backup tool as Velero. The Kubernetes Federation version 2, has simplified a lot the installation and the configuration of the federated resources over Kubernetes cluster.

The Federation API needs a control plane cluster where to install an operator, all the Custom Resources Definitions and admission webhooks. Once it is done you can federate cluster using the new CLI `kubefedctl` in straightforward manner. From that point we can create Federated Deployments, Config Maps or any builtin or customer resource registered in our Kubernetes API(s).

First step on the trip will be install the control plane controller. For that we use helm to deploy it to our Kubernetes main cluster.

```bash
> helm repo add kubefed-charts https://raw.githubusercontent.com/kubernetes-sigs/kubefed/master/charts

> helm install kubefed-charts/kubefed --name kubefed --namespace kube-federation-system
```

Once the controller and the admission webhook are running, we can start of adding member clusters to our control plane. Levering on the `kubectlfed` CLI, let's configure a source and target federated cluster easily.

```bash
> kubefedctl join cluster-source \
    --cluster-context <SOURCE_MEMBER_CUSTER_CONTEXT>
    --host-cluster-context <CONTROL_PLANE_CLUSTER_CONTEXT>


> kubefedctl join cluster-target \
    --cluster-context <TARGET_MEMBER_CUSTER_CONTEXT>
    --host-cluster-context <CONTROL_PLANE_CLUSTER_CONTEXT>
```

This command creates a customer resources (`KubeFedCluster` and `KubeFedConfig`) with the settings to access member cluster from control plane. So in order to get the list of clusters that have been federated you can run `kubectl get kubefedclusters -A`.

Now it is time to federate our workloads, Kubernetes Federation enables by default most common resources of the Kubernetes API but in case you use any special or custom resource you will need to enable. The command line interface brings some tools to convert your object in a Federated object and enabled in the control plane API. As an example we have a federation deployment example:

```yaml
apiVersion: types.kubefed.k8s.io/v1beta1
kind: FederatedDeployment
metadata:
  name: svc-to-migrate
  namespace: my-federated-ns
spec:
  template:
    <OUR_DEPLOYMENT_SPEC>
  placement:
    clusters:
    - name: cluster-source
    - name: cluster-target
```

After sending the resource to the Kubernetes Control Plane API, we will see how the federation controller will synchronized the deployment in source and target cluster. If we already have the deployment in our source it will adopting the existing resource (controller flag `adoptResources` is enabled by default in the current version).

Before start the migration we can ensure and run a smoke test against the service in the target cluster to verify it works correctly. When we are ready we can use our DNS provider to shift the traffic gradually from one domain to the other. 

In case that you want to scale in/out the deployment in source and target cluster you could combine the DNS routing shift with the `clusterOverrides` property of the federated cluster which let us define a specific number of replicas (or other property of the resource) different to the one specified in the original spec. 

__Note__: We would rather encourage to use Horizontal Pod Autoscaler to scale in/out the replicas, but in case it is not possible this technic offers a good alternative.

Upon the Kubernetes Federation API has been built some nice abstraction we could leverage when we face an migration. There is a custom resource called `ReplicaSchedulingPreference`, that helps us to maintain the number of replicas through several clusters. So you could use it to ensure there is always a fix number of replicas even when target cluster has troubles to run the new replicas. 

```yaml
apiVersion: scheduling.kubefed.io/v1alpha1
kind: ReplicaSchedulingPreference
metadata:
  name: svc-to-migrate
  namespace: my-federated-ns
spec:
  targetKind: FederatedDeployment
  totalReplicas: 9
  clusters:
    target:
      weight: 1
    source:
      weight: 2
```

It has an advantage over `clusterOverrides` property as it always ensure the number of replicas will be respected. The controller waits for sometime in order to balance the number of replicas, and also could trigger unexpected initial behaviour shuffling the number of pods until it stabilizes. Please read the official docs linked below and test the migration before to move production workloads.

## Continuous Delivery Platform

In an ideal scenario, having a proper continuous delivery system makes the cluster migration as easy as falling off a log. What it means? well having a well architected application ((12 factor application manifesto)[https://12factor.net/]) and a system that let us perform a granular releases of our applications reduce the number of steps or considerations to carry out the migration. 

Here we are taking Argo CD as our delivery system, but there are a list of [different tools you could used instead](https://landscape.cncf.io/category=continuous-integration-delivery&format=card-mode).


### Checklist before an upgrade

- Is your environment configuration properly set up?
  Since your app must read the environment specific configuraiton during deployment you need to be sure the new environment has properly configured it. 

- Are all the backend services accesible from the new cluster? 
  Sometimes some of the thridparty or dependend services are internal an only accessible within the Virtual Private CLuster or Resource Group. Ensure you prepared your new cluster infrastructure (VPC peering, VPN, DNS, ...) to avoid unexpected issues.

- Do you have deployment system that can redirect the traffic granularly to new destiny?
  In case you are running an service mesh (not all but the m,ajority) or a ingress controller (some support it) you can direct a percentage of the traffic to a new target, which in this case will be the new cluster. It can be autoamted (flagger) or manual based on the feedback given by your observability system. Doing a canary deployment will let you always comeback to your initial state quickly.

  But you dont need a very sofisticated system to achieve that. Indeed you could use durectly DNS to redirect partially your traffic to your new environment. Having your monitoring dashboards ready in one screen and the DNS server console in the other, you could gradually increase the amount of traffic the new application endpoint will receive. Be careful with the DNS caching (especially if your service comprends several microservices) and take into account DNS routing is not instantenously. 




## Conclusions

There is no a silver bullet that could make the migration a easy walk. We need to think in each specific application, which dependencies it has, configure it properly and in special test it carefully to ensure the phase out will be seamlessly. 

## Further reading

- [Velero documentation](https://velero.io/docs/v1.2.0/)
- [Spotify Good Migration Practices](https://www.youtube.com/watch?v=ix0Tw8uinWs&t=63s)