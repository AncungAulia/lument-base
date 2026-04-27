import AppLayout from "@/src/components/layouts/AppLayout";
import Play from "@/src/modules/play/Play";
import { use } from "react";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return (
    <AppLayout>
      <Play initialRoomCode={code} />
    </AppLayout>
  );
}
