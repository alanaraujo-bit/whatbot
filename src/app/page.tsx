import { redirect } from "next/navigation";

/**
 * A raiz não tem conteúdo próprio: o middleware já garantiu que só chega
 * aqui quem está autenticado, então mandamos direto para a caixa de entrada.
 */
export default function Home() {
  redirect("/conversations");
}
