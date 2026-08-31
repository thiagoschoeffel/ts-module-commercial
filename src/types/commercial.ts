import type { Component } from 'vue'

export type CommercialSection = 'clientes'
export type CustomerPage = 'list' | 'new' | 'detail' | 'edit'

export interface CommercialPageConfig {
  title: string
  subtitle?: string
  icon: Component
}
