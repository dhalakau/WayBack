import TabBar from './TabBar'

function Layout({ children }) {
  return (
    <div style={{ paddingBottom: '60px' }}>
      {children}
      <TabBar />
    </div>
  )
}

export default Layout