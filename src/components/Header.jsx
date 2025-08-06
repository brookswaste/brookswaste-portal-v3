import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/admin-dashboard">
        <img
          src="/images/brooks-logo.png"
          alt="Brooks Waste Logo"
          className="site-logo"
        />
      </Link>
    </header>
  )
}
