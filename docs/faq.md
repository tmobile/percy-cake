# Percy FAQ

## What is Configuration As Kode ?

> Configuration as Kode is the practice of storing and managing configuration resources in a source repository. You treat your application config resources as Code (versioned artifacts). By managing your application environments in tandem with your application code you gain the same benefits you get with your code. Configuration As Kode is a set of processes and practices that will save you time, increase your flexibility, and improve your system uptime.
> [Rollout Blog](https://rollout.io/blog/configuration-as-code-everything-need-know/)

## Why is it called `Percy` ?

Percy is shortened nickname for **Percival**, one of the original nights of the round table from Arthurian Legends. He is most well known for being the original hero in the **quest for the Grail**.

The Percy Editor strives to be the _holy grail_ of application configuration editors.

Unfortunately at the time of this project initial release there were already npm packages named `percival` and `percy`. I then thought of using CaCE, but this is not phoenetic and could have confusion with spelling, or with the atomic symbols for Calcium and Cesium. I tried changing the spelling to phoentic `CaKe`, but there is already an npm package for `cake`; So I pushed 2 together: `Percy-Cake` (\_Percival Configruation As Kode Editor).

## Why `YAML` ?

`JSON` is an optimal format for transmission as it can be minified but it has very strict rules on what is allowed in avalid JSON file. `YAML` is not well suited for transmission but does have the extended features we desire for describing our deployment environments.

So we have chosen `YAML` as the base format for storing configuration content due to it's advanced processing tools. `YAML` supports `aliasing` (`anchors`) with `overrides`, `types` and `comments`. There are tools that can be schema validate yaml files and pre-hydrate them (replace aliases with copies of referenced anchors _with_ overridden values updated) into Javascript objects, which then are easily exported as JSON objects.
