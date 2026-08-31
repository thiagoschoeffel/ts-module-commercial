import { UsersIcon } from '@thiagoschoeffel/ts-components'
import type { CommercialPageConfig, CommercialSection } from '../types/commercial'

export const commercialPages: Record<CommercialSection, CommercialPageConfig> = {
  clientes: {
    title: 'Clientes',
    subtitle: 'Cadastros, preferências e restrições para um atendimento mais rápido.',
    icon: UsersIcon
  }
}
