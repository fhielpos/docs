+++
title = "Cluster migration in Kubernetes"
description = "This guide will walk you through all necessary steps to do a successfully migration from one cluster to other."
date = "2020-01-20"
type = "page"
weight = 70
tags = ["tutorial"]
+++

# Kubernetes Cluster Migration

## Overview

There some occasions where we would like to move our applications from one environment to other. There could be a plenty of reasons, migration from on-premise to the cloud, migration to a different cloud, recovery strategy or a requirement imposed by the current platform (not upgradable between platform versions). Here we are focussing in the later, and more in special in a cluster migration in a Kubernetes platform, although I reckon some points will be valid for the other scenarios as well.

Giant Swarm most of the time offers upgrades in-place so customers don't need to spin up a new cluster to get access to the newer platform release. Instead, the nodes are roll out following the immutable principles as we describe [in this guide](upgrade link guide). But some times the clusters are not upgradable for different reasons like networking architecture changes or a break change in a component of the stack.

A good first step for a migration is a elaborate a detailed planning. As the scope of a migration can be quite huge, the best idea is to break down the operation in multiple steps. Taking first a small non critical service, that could comprehend multiple interconnected components, and moving it to the new cluster will be easier and give us confidence on the entire goal. 

There are some considerations to make when we are selecting a service for the migration. We must to think and answer questions like "Has the selected service got any dependency within the same cluster or external service? (like it needs to talk to an internal API)", "Is there any requisite needed to properly run the service in the newer cluster? (like it must run on a specific hardware)", "Is there any change or incompatibility in the newer cluster that can prevent the application to run correctly? (new API schema for a Kubernetes resource that may impact on the service)", ... Apart can eb enhancement or feature that our service can take advantage but I would leave those for next steps after migration is done (small steps, small failures). 

## Alternatives

Once we have agreed on the planing part, we need to select which tools and procedures will help us to succeed with the mission. Obviously is impossible to list all alternatives, especially because for each migration case there will be some exceptions or impediments that varies the plan design.

Here I list three options that can help us depend on the context and the maturity of our continuous delivery system. 

- As the first option, we could use the amazing tool [Velero](), former Ark, created by Heptio. Although this tool is thought to be used as backup and restore solution, it opens the door to use it for a migration to a new cluster. If we need to migrate our application to a new cluster quick and dirty it would most likely the easiest solution. We would recommend it for exploitative or testing use cases where we can find if our application will run in the new cluster correctly. 

- As second possibility would be use [Kubernetes Federation](). Beside sequels have not always been successful, the second version of federation works pretty well and allows us to control our migration in detail.

- The most sophisticated way of migrating our application is to use a proper continues delivery platform. For example, using Spinnaker or Argo CD will help us to configure a new pipeline or stage in our deployment configurations that releases the application in the new cluster. At the same time, they offer us a mechanism to redirect the traffic accordingly to have a finer grade control in case any failure appears. 

## Use Velero to backup and restore your application

This tool is formed by command line tool and an [operator](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/) running as a pod in your Kubernetes cluster. Once you have the installed the `velero` CLI you can use it to deploy the server into your cluster. 

Velero relies on [KubernetesCustom Resources](https://kubernetes.io/docs/concepts/api-extension/custom-resources/#customresourcedefinitions) like `BackupStorageLocation`, `Backup` or `Restore` to configure and manage the flow of the backup and restore actions. Behind the scene, Velero stores a backup of the Kubernetes resources running in the cluster in a compress file on the cloud object storage defined. Further, it uses the Cloud provider API to take snapshots of the volumes used for the workloads. Therefore, for the installation you need to pass Cloud credentials along with the object storage location.

```bash
velero install
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.0.0 \
    --bucket velero-fer \
    --backup-location-config region=eu-central-1 \
    --snapshot-location-config region=eu-central-1
```
__Note__: Example to install the Velero operator in the Kubernetes cluster registered in your command line.

We must install Velero operator in both clusters, origin and target (both pointing to the same backup location).

```bash
velero backup create migration --include-namespaces="default"
```

In the target

```bash
velero restore create --from-backup migration
```

Be sure you only copy the resources related to your application. We can use labels to filter...
In the backup file you can get the list uncompressing the tarball of reousrcces athat are stored.
Velero is quite advance an only copy cluster resources (like ClusterROle) that are used in the namespace or pods you target.

Also is good to ensure the application we backup will not generate any unexpected behavior one is runnig in other cluster. As example if we take a backup of external DNS (manage DNS entries in your DNS Cloud Provider) and restore it in a new cluster we could end up duplicating record sets.


## Kubernetes Federation

## Continuous Delivery Platform

In an ideal scenario, having a proper continuous delivery system makes the cluster migration as easy as falling off a log. What it means? well having a well architected application ((12 factor app)[https://12factor.net/]) and a system that let us perform a granular releases of our applications reduce the number of steps or considerations to carry out the migration. But being honest this is not always the reality, we usually find app's configuration with parameters tied it to the current environment or release systems that does not offer much flexibility selecting the target location for our application deployments. 
 Use your deployment system to deploy and release the application in the new environment. 


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