import type { DeliveryDriver } from '../types/deliveryDriver'

let drivers: DeliveryDriver[] = []
export function setDeliveryDrivers(items: DeliveryDriver[]) { drivers = structuredClone(items) }
export function getDeliveryDrivers(): DeliveryDriver[] { return structuredClone(drivers) }
export function findDeliveryDriver(driverId?: string) { return driverId ? drivers.find(driver => driver.id === driverId) : undefined }
export function findDeliveryDriverByName(name?: string) { return name ? drivers.find(driver => driver.name === name) : undefined }
