import { Navigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext.jsx';

// Wraps every authenticated page. If there's no token, bounces to the
// landing page so the OTP modal can take over.
export default function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  return children;
}
