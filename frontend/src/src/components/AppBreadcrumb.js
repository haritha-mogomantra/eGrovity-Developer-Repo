import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import routes from '../routes'
import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'

const AppBreadcrumb = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const currentLocation = location.pathname

  const getRouteName = (pathname) => {
    const route = routes.find(r => r.path === pathname)
    return route ? route.name : null
  }

  const getBreadcrumbs = (path) => {
    const breadcrumbs = []
    path.split('/').reduce((prev, curr, index, arr) => {
      if (!curr) return prev
      const currentPath = `${prev}/${curr}`
      const name = getRouteName(currentPath)
      if (name) {
        breadcrumbs.push({
          pathname: currentPath,
          name,
          active: index === arr.length - 1,
        })
      }
      return currentPath
    }, '')
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(currentLocation)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        Home
      </CBreadcrumbItem>

      {breadcrumbs.map((b, i) => (
        <CBreadcrumbItem
          key={i}
          active={b.active}
          style={{ cursor: b.active ? 'default' : 'pointer' }}
          onClick={() => {
            if (!b.active) navigate(b.pathname)
          }}
        >
          {b.name}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
