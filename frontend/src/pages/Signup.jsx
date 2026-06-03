import { Navigate } from 'react-router-dom';

/** Legacy route — registration lives on the Landing page. */
export default function Signup() {
  return <Navigate to="/?register=1" replace />;
}
