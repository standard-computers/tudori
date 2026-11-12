# Architecture rules

- Create bulk delivery packaging units through `createDeliveryPackages` with one insert after generating all numbers, so failures cannot save a partial group and units remain scoped to their delivery.