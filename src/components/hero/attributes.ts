import { ATTRIBUTE_LABEL, ATTRIBUTES, type AttributeId } from "../../../shared/hero";
import { BookOpenIcon, BriefcaseIcon, DumbbellIcon, SparklesIcon, WalletIcon, type IconComponent } from "../ui/Icon";

/** Ícone de cada atributo (o rótulo vem de shared/hero). */
export const ATTRIBUTE_ICON: Readonly<Record<AttributeId, IconComponent>> = {
  fisica: DumbbellIcon,
  mental: BookOpenIcon,
  profissional: BriefcaseIcon,
  espiritual: SparklesIcon,
  financeira: WalletIcon,
};

/** De onde vem o XP de cada atributo (uma linha, na trilha e no editor de missões). */
export const ATTRIBUTE_SOURCE: Readonly<Record<AttributeId, string>> = {
  fisica: "Vem do XP dos treinos e das missões de Física.",
  mental: "Vem das tarefas da área Faculdade e das missões de Mental.",
  profissional: "Vem das tarefas da área Trabalho e das missões de Profissional.",
  espiritual: "Vem só das missões de Espiritual (ex.: meditar).",
  financeira: "Vem dos dias com gasto, receita ou aporte registrado pelo Agente Finanças (+10 XP por dia) e das missões de Financeira.",
};

export const ATTRIBUTE_OPTIONS = ATTRIBUTES.map((id) => ({ id, label: ATTRIBUTE_LABEL[id] }));
