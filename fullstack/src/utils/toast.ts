import { toast } from "sonner";

type ToastOptions = {
  description?: string;
  id?: string;
};

export function showSuccessToast(title: string, options?: ToastOptions) {
  toast.success(title, {
    description: options?.description,
    id: options?.id,
  });
}

export function showErrorToast(title  : string, options?: ToastOptions) {
  toast.error(title, {
    description: options?.description,
    id: options?.id,
  });
}

export function showInfoToast(title: string, options?: ToastOptions) {
  toast(title, {
    description: options?.description,
    id: options?.id,
  });
}
