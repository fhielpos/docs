---
title: Node Pools
description: A general description of node pools as a concept, it's benefits, and some details you should be aware of.
date: 2020-07-31
weight: 130
type: page
categories: ["basics"]
---

# Node Pools on AWS

## Definition

A node pool is a set of nodes within a Kubernetes cluster that share a same configuration (instance type, CIDR range, etc.). Each node in the pool is labeled by the node pool's name

## Advantages

Prior to the introduction of node pools, a cluster could only comprise one type of worker node. The cluster would have
to be scaled as a whole, and the availability zone distribution would apply to all worker nodes of a cluster. This
would mean that every worker node would have to be big enough to run the largest possible workload, in terms of
memory and CPU resources required. At the same time, all worker nodes in the cluster would have to use the same
availability zone distribution, even if some workloads wouldn't require the increased availability.

Node pools are independent groups of worker nodes belonging to a cluster, where all nodes within a pool share a
common configuration. You can combine any type of node pool within one cluster. Node pools can differ regarding:

- EC2 instance type
- Availability zone distribution
- Scaling configuration (number of nodes)

A node pool is identified by a unique ID that is generated on creation and by a name that you can pick as a cluster
administrator.

## Lifecycle

Node pools can be created when creating a cluster

- via the Giant Swarm web interface
- via the CLI command [`gsctl create cluster`](/reference/gsctl/create-cluster/)

or any time after the cluster has been created

- via the Giant Swarm web interface
- via the CLI command [`gsctl create nodepool`](/reference/gsctl/create-nodepool/)

These tools also support modification of node pools and their deletion.

Once a node pool has been created, as soon as the workers are available, they will
join the cluster and appear in your `kubectl get nodes` listing. You can identify the
nodes' node pool using the `giantswarm.io/machine-deployment` label.

The example `kubectl` command below will list all nodes with role, node pool ID, and name.

```nohighlight
kubectl get nodes \
  -o=jsonpath='{range .items[*]}{.metadata.labels.kubernetes\.io/role}{"\t"}{.metadata.labels.giantswarm\.io/machine-deployment}{"\t"}{.metadata.name}{"\n"}{end}' | sort
master         ip-10-1-5-55.eu-central-1.compute.internal
worker  7zypn  ip-10-1-6-225.eu-central-1.compute.internal
worker  7zypn  ip-10-1-6-67.eu-central-1.compute.internal
```

Some details of a node pool can be modified after creation:

- The node pool name
- The scaling range (min/max)

Settings like the instance type or the availability zone assignment cannot be changed after creation.

See the [`gsctl update nodepool`](/reference/gsctl/update-nodepool/) reference for instructions how to scale and rename a node pool using the CLI.

## Assigning workloads to node pools {#assigning-workloads}

Knowing the node pool ID of the pool to use, you can use the `nodeSelector` method of assigning pods to the node pool.

Assuming that the node pool ID is `a1b2c`, your `nodeSelector` should look like this (for example):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx
  nodeSelector:
    giantswarm.io/machine-deployment: a1b2c
```

You can assign workloads to node pools in a more indirect way too. This is achieved by using other node attributes which are
specified via the node pool and which are exposed as node labels.

For example: In a case where you have node pools with one instance type. Using a `nodeSelector` with the label `node.kubernetes.io/instance-type` (or in Kubernetes before v1.17: `beta.kubernetes.io/instance-type`) you can assign workloads to matching nodes only.

Another example: In a case where you have different node pools using different availability zones. With a `nodeSelector` using the label `topology.kubernetes.io/zone` (or in Kubernetes before v1.17: `failure-domain.beta.kubernetes.io/zone`) you can assign your workload to the nodes in a particular availability zone.

## Node pool deletion

You can delete a node pool at any time using the Giant Swarm API and user interfaces. When a node pool gets deleted the following things will happen:

- nodes in the pool will be marked as unschedulable and then drained, resulting in Pods being unassigned from the nodes
and containers being stopped.
- Then the actual nodes (EC2 instanced) will be removed.

If you are deleting a node pool running critical workloads, we recommend taking the following precautions:

- Make sure there is at least one node pool with enough nodes to pick up the workloads.
- Double-check any taints and node selectors of your workloads to make sure they can land on different nodes.
- For maximum control, cordon all of the node pool's nodes and then drain them manually, one by one.

Pay close attention to the workloads being rescheduled on other nodes once nodes are drained.

See the [`gsctl delete nodepool`](/reference/gsctl/delete-nodepool/) reference for how to delete a node pool using the CLI.

## On-demand and spot instances {#on-demand-spot}

As of release v{{% first_aws_spotinstances_version %}} on AWS, node pools can contain a mix of [on-demand](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-on-demand-instances.html) and [spot instances](https://aws.amazon.com/ec2/spot/) that will allow you to optimize your cost.

The main differences between spot and on-demand instances are that spot instances can be terminated any time by AWS. They are also more frequently unavailable.

The hourly price for a spot instance is determined by AWS through a bidding system. The resulting price varies over time and is usually much lower than the cost of the same instance type when booked as on-demand instance. To maximize the likelihood of getting a spot instance when needed, the configuration for Giant Swarm is set to bid up to the price of an on-demand instance with the same type, but not more.

There are two parameters on the node pool level that will allow you to configure which instances are going to be used:

- **On-demand base capacity**: controls how much of the initial capacity is made up of on-demand instances. Note that this capacity is static and does not automatically replace any unavailable spot instances.

- **Spot instance percentage above base capacity**: controls the percentage of spot instances to be used for worker nodes beyond the number of *on-demand base capacity*.

### Notes on using spot instances

Since the availability of spot instances is volatile, there are a few things you can consider:

- The more availability zones you cover with your node pool, the higher the likelihood that spot instances are available when required.
- Activating the [use of similar instance types](#similar-instance-types) also increases the likelihood of getting spot instances when using common instance types. Read more about this below.
- When no spot instances are unavailable, missing spot instances are _not_ replaced by on-demand instances. The affected node pool will instead have less nodes than desired, probably leaving some pods unscheduled. For a solution to this, check our guide on [using on-demand instances as fall-back when spot instances are unavailable](/guides/spot-instances-with-on-demand-fallback/).

### Examples

The following table shows four examples to illustrate how different settings of spot instance percentage and on-demand base capacity influence the outcome.

| On-demand base capacity | Spot instance percentage | Total Instances  | On-Demand Instances| Spot Instances
|:-:|:-:|:-:|:-:|:-:|
| 0 | 0 % | 50 | 50 | 0
| 0 | 100 % | 50 | 0 | 50
| 10 | 50 % | 50 | 30 | 20
| 10 | 100 % | 50 | 10 | 40

## Using similar instance types {#similar-instance-types}

Starting with release v{{% first_aws_spotinstances_version %}} on AWS you can activate the use of similar instance types per node pool. With this setting active, your node pool can use instance types that are nearly identical to the one you selected. For example, if you select `m5.xlarge`, the node pool can also use `m4.xlarge`.

Using multiple instance types in a node pool has some benefits:

- Together with spot instances, using multiple instance types allows better price optimization. Popular instance types tend to have more price adjustments. Allowing older-generation instance types that are less popular tends to result in lower costs and fewer interruptions.

- Even without spot instances, AWS has a limited number of instances per type in each Availability Zone. It can happen that your selected instance type is temporarily out of stock just in the moment you are in demand of more worker nodes. Allowing the node pool to use multiple instance types reduces this risk and increases the likelihood that your node pool can grow when in need.

Instances that contain the same amount of CPU and RAM are considered similar. We provide more information regarding which instance types are considered similar in our [reference](/reference/similar-ec2-instance-types/).

## Node pools and the Giant Swarm API {#restapi}

Handling clusters with node pools requires an API schema different from the one used for clusters
with homogeneous worker nodes. To account for this need, we introduced a new API version path `v5`.

Using the v5 API endpoints, you can

- [Create a new cluster supporting node pools](/api/#operation/addClusterV5)
- [Get node pools of a cluster](/api/#operation/getNodePools)
- [Create a new node pool](/api/#operation/addNodePool)
- [Modify a cluster](/api/#operation/modifyClusterV5)
- [Modify a node pool](/api/#operation/modifyNodePool)
- [Delete a node pool](/api/#operation/deleteNodePool)

## Node pools and the cluster definition YAML format

Just as the Giant Swarm API schema for v4 (without node pools) and v5 (with node pools) clusters are different, the
[cluster definition format](/reference/cluster-definition/) is different between the two versions.

The new definition schema for v5 allows for defining cluster and node pool details in one file,
to be submitted for creation via the [`gsctl create cluster`](/reference/gsctl/create-cluster/) command.

## Node pools and autoscaling {#autoscaling}

With node pools, you set the autoscaling range per node pool. The Kubernetes cluster autoscaler has to decide which node pool to scale under which circumstances.

If you assign workloads to node pools as described [above](#assigning-workloads) and the autoscaler finds pods in `Pending` state, it will decide based on the node selectors which node pools to scale up.

In case there are workloads not assigned to any node pools, the autoscaler may pick any node pool for scaling. For details on the decision logic, please check the upstream [FAQ for AWS](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/cloudprovider/aws/README.md).

## Limitations

- A node pool can have a maximum of 250 worker nodes. The architectural reason for this is that each node pool gets a `/24` IPv4 subnet assigned. However 5 IP addresses per availability zone used are not usable for worker nodes, as they are reserved for other AWS resources. Hence the limit depends on the number of availability zones used by a node pool. If the pool uses two zones, it's 245. With three zones, the limit is 240, and with four zones, it's 235.

- At times, the EC2 instance type required by a node pool can be unavailable in certain availability zones. This can
result in node pools providing less than the desired number of nodes. The more availability zones a node pool spans,
the less likely this problem is to occur.

- By default, clusters can have up to 5 node pools. This is limited by the AWS service quota named "IPv4 CIDR blocks
per VPC" in the [VPC section](https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html). As the AWS
account owner, you can request an increase of this limit via the AWS console.

- Node pools can span a maximum of four availability zones. This limit affects both the number of availability zones
a single node pool can cover, as well as the number of different availability zones all node pools of a cluster can
cover. Once an availability zone has been assigned for use in a cluster, either for the master node or for worker
nodes, it cannot be unassigned from that cluster. It will remain assigned even if there are no more node pools using
that availability zone.

  - **Example:** The master node is in availability zone A. Node pool 1 uses availability zones B and C. Node pool 2 uses
  availability zone D. With A, B, C, and D, the limit of four availability zones assigned is reached. New node pools of this
  cluster can only use these four availability zones.
  
- Clusters without worker nodes (= without node pools) cannot be considered fully functional. In order to have all
required components scheduled, worker nodes are required. For that reason, we deactivate any monitoring and alerts for
these clusters and don't provide any proactive support.

- We also do not monitor node pools with less than three worker nodes and do not provide any proactive support for those.

- When creating a new node pool, the master node of the cluster is re-created. This causes a downtime of the Kubernetes
API of a couple of minutes.

## Further reading

- [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/) from the official Kubernetes documentation
