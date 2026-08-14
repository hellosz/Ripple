import { Suspense } from "react";
import { DeviceAuth } from "./DeviceAuth";

export default function DeviceAuthPage() {
  return (
    <Suspense fallback={<div className="text-center text-white/50">加载中...</div>}>
      <DeviceAuth />
    </Suspense>
  );
}
