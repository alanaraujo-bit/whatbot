/**
 * Som de notificação sintetizado via Web Audio API.
 *
 * Evita embarcar um arquivo de áudio: são ~40 linhas contra um binário que
 * precisaria ser versionado, baixado e cacheado. Também deixa o timbre
 * ajustável sem reeditar mídia.
 */

let audioContext: AudioContext | null = null;

/**
 * Navegadores bloqueiam áudio até o usuário interagir com a página. Criamos o
 * contexto sob demanda e o reaproveitamos — instanciar um por som estoura o
 * limite de contextos do navegador.
 */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }

  return audioContext;
}

/** Toca uma nota senoidal com envelope suave (sem clique no ataque/decaimento). */
function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  // Envelope: sobe rápido, cai exponencialmente. Um ganho constante produziria
  // um "click" audível ao cortar a onda no meio do ciclo.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.16, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

/**
 * Toca um chime curto de duas notas (Lá5 → Dó#6), discreto o bastante para
 * um ambiente de trabalho com muitas mensagens.
 */
export function playNotificationSound(): void {
  const ctx = getContext();
  if (!ctx) return;

  // O contexto pode ter sido suspenso pelo navegador em segundo plano.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* sem permissão de áudio ainda; silenciar é o comportamento correto */
    });
  }

  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.13);
  playTone(ctx, 1108.73, now + 0.1, 0.22);
}
