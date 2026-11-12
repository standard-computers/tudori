# Architecture rules

- Create bulk delivery packaging units through `createDeliveryPackages` using the atomic `create_delivery_packages` RPC; it locks the company sequence and inserts each unit before generating the next number because numbering reads persisted units, while failures roll back the whole group.