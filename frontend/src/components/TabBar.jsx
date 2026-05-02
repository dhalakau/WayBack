import { Link } from 'react-router-dom'

function TabBar() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTop: '1px solid #ddd',
      display: 'flex',
      padding: '12px 0'
    }}>
      <Link to="/" style={{
        flex: 1,
        textAlign: 'center',
        textDecoration: 'none',
        color: '#333'
      }}>
        Map
      </Link>
      <Link to="/feed" style={{
        flex: 1,
        textAlign: 'center',
        textDecoration: 'none',
        color: '#333'
      }}>
        Feed
      </Link>
    </div>
  )
}

export default TabBar