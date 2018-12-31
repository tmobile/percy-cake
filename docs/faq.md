# Percy FAQ

## What is Configuration As Code ?

> Configuration as code (CAC) is managing configuration resources in your source repository. You treat your application config resources as versioned artifacts. By managing your application environment in tandem with your application code, you gain the same benefits you get with your code. CaC is a set of processes and practices that will save you time, increase your flexibility, and improve your system uptime.
> [Rollout Blog](https://rollout.io/blog/configuration-as-code-everything-need-know/)

## Why is it called `Percy` ?

Percy is shortened nickname for **Percival**, one of the original nights of the round table from Arthurian Legends. He is most well known for being the original hero in the **quest for the Grail**.

The Percy Editor strives to be the _holy grail_ of application configuration editors.

## Why `YAML` ?

We have chosen `YAML` as the base format for storing configuration content due to it's advanced processing tools. `YAML` supports aliasing (anchors) with overrides, types and comments. There are tools that can schema validate yaml files and pre-hydrate them (replace aliases with copies of refernced anchor _with_ overridden values updated) into Javascript objects.
