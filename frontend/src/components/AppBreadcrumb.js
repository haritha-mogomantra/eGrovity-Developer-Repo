import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import routes from '../routes'
import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'


const MASTER_LABELS = {
  roles: 'Roles',
  departments: 'Departments',
  metrics: 'Measurements',
  projects: 'Projects',
}

const AppBreadcrumb = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const currentLocation = location.pathname

  const getRouteName = (pathname) => {
    if (pathname === '/masters') {
      return 'Master Modules'
    }
    const route = routes.find(r => r.path === pathname)
    return route ? route.name : null
  }

  const getBreadcrumbs = (path) => {
    const breadcrumbs = []
    const segments = path.split('/').filter(Boolean)

    let currentPath = ''

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`

      // Master Modules parent
      if (segment === 'masters') {
        breadcrumbs.push({
          pathname: currentPath,
          name: 'Master Modules',
          active: false,
        })
        return
      }

      // Master Modules children
      if (segments[index - 1] === 'masters') {
        breadcrumbs.push({
          pathname: currentPath,
          name: MASTER_LABELS[segment] || segment,
          active: true,
        })
        return
      }

      const name = getRouteName(currentPath)
      if (name) {
        breadcrumbs.push({
          pathname: currentPath,
          name,
          active: index === segments.length - 1,
        })
      }
    })

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
