import type { DeliveryDriver } from '../types/deliveryDriver'

const storageKey = 'ts-management-delivery-drivers-v1'
const fallbackDeliveryDrivers: DeliveryDriver[] = [
  { id: 'ent-1001', name: 'Carlos Souza', phone: '(11) 99876-4321', active: true },
  { id: 'ent-1002', name: 'Mariana Lima', phone: '(11) 98765-1204', active: true },
  { id: 'ent-1003', name: 'Rafael Santos', active: true },
  { id: 'ent-1004', name: 'Beatriz Oliveira', phone: '(11) 97654-8090', active: false }
]

export function getDeliveryDrivers(): DeliveryDriver[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as DeliveryDriver[]
    const savedIds = new Set(saved.map(driver => driver.id))
    return structuredClone([...saved, ...fallbackDeliveryDrivers.filter(driver => !savedIds.has(driver.id))])
  }
  catch {
    return structuredClone(fallbackDeliveryDrivers)
  }
}

export function findDeliveryDriver(driverId?: string) {
  return driverId ? getDeliveryDrivers().find(driver => driver.id === driverId) : undefined
}

export function findDeliveryDriverByName(name?: string) {
  return name ? getDeliveryDrivers().find(driver => driver.name === name) : undefined
}
