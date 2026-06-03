import { Metadata } from 'next';
import InviteClient from './InviteClient';

export const metadata: Metadata = {
  title: 'Accept Invite - FrameVid',
};

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E0E11] p-4">
      <div className="w-full max-w-md">
        <InviteClient token={params.token} />
      </div>
    </div>
  );
}
