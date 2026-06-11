import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Button from './Button';
import Modal from './Modal';

type ConfirmationTone = 'default' | 'danger';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  requiredConfirmationText?: string;
  typedConfirmationLabel?: string;
  typedConfirmationHelp?: ReactNode;
}

interface AlertOptions {
  title: string;
  message: ReactNode;
  acknowledgeLabel?: string;
}

interface ConfirmationContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

type PendingDialog =
  | {
      kind: 'confirm';
      options: {
        title: string;
        message: ReactNode;
        confirmLabel: string;
        cancelLabel: string;
        tone: ConfirmationTone;
        requiredConfirmationText?: string;
        typedConfirmationLabel?: string;
        typedConfirmationHelp?: ReactNode;
      };
      resolve: (confirmed: boolean) => void;
    }
  | {
      kind: 'alert';
      options: Required<AlertOptions>;
      resolve: () => void;
    };

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

function resolvePendingAsCanceled(current: PendingDialog | null) {
  if (!current) return;
  if (current.kind === 'confirm') {
    current.resolve(false);
  } else {
    current.resolve();
  }
}

function renderMessage(message: ReactNode) {
  if (typeof message !== 'string') return message;
  return <p className="whitespace-pre-line text-sm leading-relaxed text-ink-light">{message}</p>;
}

export function getTypedConfirmationState(
  requiredConfirmationText: string | undefined,
  draft: string
) {
  const expectedText = requiredConfirmationText?.trim() ?? '';
  const required = expectedText.length > 0;
  return {
    required,
    expectedText,
    confirmed: !required || draft.trim() === expectedText,
  };
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [typedDraft, setTypedDraft] = useState('');
  const typedInputId = useId();
  const typedHelpId = useId();

  const closeConfirm = useCallback((confirmed: boolean) => {
    setTypedDraft('');
    setPending((current) => {
      if (current?.kind === 'confirm') {
        current.resolve(confirmed);
      } else if (current?.kind === 'alert') {
        current.resolve();
      }
      return null;
    });
  }, []);

  const confirm = useCallback<ConfirmationContextValue['confirm']>((options) => {
    return new Promise<boolean>((resolve) => {
      setTypedDraft('');
      setPending((current) => {
        resolvePendingAsCanceled(current);
        return {
          kind: 'confirm',
          options: {
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel ?? 'Confirm',
            cancelLabel: options.cancelLabel ?? 'Cancel',
            tone: options.tone ?? 'default',
            requiredConfirmationText: options.requiredConfirmationText?.trim(),
            typedConfirmationLabel: options.typedConfirmationLabel,
            typedConfirmationHelp: options.typedConfirmationHelp,
          },
          resolve,
        };
      });
    });
  }, []);

  const alert = useCallback<ConfirmationContextValue['alert']>((options) => {
    return new Promise<void>((resolve) => {
      setTypedDraft('');
      setPending((current) => {
        resolvePendingAsCanceled(current);
        return {
          kind: 'alert',
          options: {
            title: options.title,
            message: options.message,
            acknowledgeLabel: options.acknowledgeLabel ?? 'OK',
          },
          resolve,
        };
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [alert, confirm]);
  const typedState =
    pending?.kind === 'confirm'
      ? getTypedConfirmationState(
          pending.options.requiredConfirmationText,
          typedDraft
        )
      : getTypedConfirmationState(undefined, typedDraft);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {pending && (
        <Modal
          open
          onClose={() => closeConfirm(false)}
          title={pending.options.title}
        >
          <div className="space-y-5">
            <div>{renderMessage(pending.options.message)}</div>
            {pending.kind === 'confirm' ? (
              <div className="space-y-4">
                {typedState.required && (
                  <div className="rounded-md border border-seal/25 bg-seal/5 p-3">
                    <label
                      htmlFor={typedInputId}
                      className="block text-[10px] font-semibold uppercase tracking-wider text-seal"
                    >
                      {pending.options.typedConfirmationLabel ??
                        `Type ${typedState.expectedText} to confirm`}
                    </label>
                    <input
                      id={typedInputId}
                      data-autofocus="true"
                      value={typedDraft}
                      onChange={(event) => setTypedDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && typedState.confirmed) {
                          event.preventDefault();
                          closeConfirm(true);
                        }
                      }}
                      aria-describedby={typedHelpId}
                      className="mt-1.5 w-full rounded-md border border-ledger-line bg-parchment px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-seal focus:ring-2 focus:ring-leather/20"
                    />
                    <div id={typedHelpId} className="mt-1.5 text-xs text-ink-light">
                      {pending.options.typedConfirmationHelp ??
                        `This action stays disabled until the exact phrase ${typedState.expectedText} is entered.`}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    data-autofocus={typedState.required ? undefined : 'true'}
                    onClick={() => closeConfirm(false)}
                  >
                    {pending.options.cancelLabel}
                  </Button>
                  <Button
                    variant={pending.options.tone === 'danger' ? 'destructive' : 'primary'}
                    disabled={!typedState.confirmed}
                    onClick={() => {
                      if (typedState.confirmed) closeConfirm(true);
                    }}
                  >
                    {pending.options.confirmLabel}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button data-autofocus="true" onClick={() => closeConfirm(true)}>
                  {pending.options.acknowledgeLabel}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used inside ConfirmationProvider');
  }
  return context;
}
