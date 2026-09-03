import { BadgeDollarSignIcon, BookOpenIcon, UsersIcon } from '@thiagoschoeffel/ts-components'
import type { CommercialPageConfig, CommercialSection } from '../types/commercial'

export const commercialPages: Record<CommercialSection, CommercialPageConfig> = {
  cardapios: {
    title: 'Cardápios',
    subtitle: 'Planeje e publique as ofertas de cada dia operacional.',
    icon: BookOpenIcon
  },
  clientes: {
    title: 'Clientes',
    subtitle: 'Cadastros, preferências e restrições para um atendimento mais rápido.',
    icon: UsersIcon
  },
  planos: {
    title: 'Planos e Créditos',
    subtitle: 'Gerencie benefícios, aquisições e o saldo rastreável dos clientes.',
    icon: BadgeDollarSignIcon
  }
}
