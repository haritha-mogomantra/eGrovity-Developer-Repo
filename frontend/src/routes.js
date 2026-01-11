import React from 'react'
import { Navigate } from 'react-router-dom'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const AdminDashboard = React.lazy(() => import('./views/dashboard/AdminDashboard'))
const EmployeeDashboard = React.lazy(() => import('./views/dashboard/EmployeeDashboard'))

const PerformanceMetrics = React.lazy(() => import('./views/theme/performancemetrics/PerformanceMetrics'))
const Typography = React.lazy(() => import('./views/theme/typography/Typography'))


// Base
const employeedetails = React.lazy(() => import('./views/base/employeedetails/employeedetails'))
const employeeperformance = React.lazy(() => import('./views/base/employeeperformance/EmployeePerformance'))
const Cards = React.lazy(() => import('./views/base/cards/Cards'))
const Carousels = React.lazy(() => import('./views/base/carousels/Carousels'))
const Collapses = React.lazy(() => import('./views/base/collapses/Collapses'))
const ListGroups = React.lazy(() => import('./views/base/list-groups/ListGroups'))
const Navs = React.lazy(() => import('./views/base/navs/Navs'))
const Paginations = React.lazy(() => import('./views/base/paginations/Paginations'))


const Tabs = React.lazy(() => import('./views/base/tabs/Tabs'))

const Tooltips = React.lazy(() => import('./views/base/tooltips/Tooltips'))

//new
const Performance = React.lazy(()=>import('./views/performance/performance'))
const AdminProfile = React.lazy(() => import('./views/pages/adminprofile/AdminProfile'))
const EmployeeProfile = React.lazy(() => import('./views/pages/employeeprofile/EmployeeProfile'))
const ChangePassword = React.lazy(
  () => import("./views/base/list-groups/ListGroups")
);

const Profile = React.lazy(
  () => import("./components/profile/Profile")
);


// Buttons
const Buttons = React.lazy(() => import('./views/buttons/buttons/Buttons'))
const ButtonGroups = React.lazy(() => import('./views/buttons/button-groups/ButtonGroups'))
const Dropdowns = React.lazy(() => import('./views/buttons/dropdowns/Dropdowns'))

//Forms
const ChecksRadios = React.lazy(() => import('./views/forms/checks-radios/ChecksRadios'))
const FloatingLabels = React.lazy(() => import('./views/forms/floating-labels/FloatingLabels'))
const FormControl = React.lazy(() => import('./views/forms/form-control/FormControl'))
const InputGroup = React.lazy(() => import('./views/forms/input-group/InputGroup'))
const Layout = React.lazy(() => import('./views/forms/layout/Layout'))
const Range = React.lazy(() => import('./views/forms/range/Range'))
const Select = React.lazy(() => import('./views/forms/select/Select'))
const Validation = React.lazy(() => import('./views/forms/validation/Validation'))

const Charts = React.lazy(() => import('./views/charts/Charts'))

// Icons
const CoreUIIcons = React.lazy(() => import('./views/icons/coreui-icons/CoreUIIcons'))
const Flags = React.lazy(() => import('./views/icons/flags/Flags'))
const Brands = React.lazy(() => import('./views/icons/brands/Brands'))

// Notifications
const Alerts = React.lazy(() => import('./views/notifications/alerts/Alerts'))
const Badges = React.lazy(() => import('./views/notifications/badges/Badges'))
const Modals = React.lazy(() => import('./views/notifications/modals/Modals'))
const Toasts = React.lazy(() => import('./views/notifications/toasts/Toasts'))

const Widgets = React.lazy(() => import('./views/widgets/Widgets'))

const MasterModule = React.lazy(() => import('./views/masters/MasterModule'))

const EmployeeLifecycleHistory = React.lazy(
  () => import('./modules/employeeLifecycle/EmployeeLifecycleHistory')
)


const routes = [
  { path: '/dashboard', name: null, element: Dashboard },
  { path: '/admin-dashboard', name: 'Dashboard', element: AdminDashboard },
  { path: '/employee-dashboard', name: 'Dashboard', element: EmployeeDashboard },
  // Reports (PARENT)
  { path: '/reports', name: 'Reports', element: Buttons },

  // Reports (CHILDREN)
  { path: '/reports/weekly', name: 'Weekly Report', element: Buttons },
  { path: '/reports/manager', name: 'Manager Wise Report', element: Buttons },
  { path: '/reports/department', name: 'Department Wise Report', element: Buttons },

  { path: '/performance', name: 'Performance', element: Performance },


  { path: '/theme', name: null, element: PerformanceMetrics, exact: true },

  { path: '/theme/performancemetrics', name: 'Performance Metrics', element: PerformanceMetrics },

  { path: '/theme/typography', name: null, element: Typography },

  
  { path: '/base/employeedetails', name: 'Employee Details', element: employeedetails },


  { path: '/base/employeeperformance', name: 'Employee Performance', element: employeeperformance },
  { path: '/base/employee-credentials', name: 'Employee Credentials', element: Cards },


  { path: '/base', name: null, element: Cards, exact: true },
  { path: '/base/cards', name: 'Employee Credentials', element: Cards },
  { path: '/base/carousels', name: null, element: Carousels },
  { path: '/base/collapses', name: null, element: Collapses },
  { path: '/base/list-groups', name: null, element: ListGroups },
  { path: '/base/navs', name: null, element: Navs },
  { path: '/base/paginations', name: null, element: Paginations },
  
  
  { path : '/pages/adminprofile', name: 'Profile' , element:AdminProfile},
  { path: '/pages/employeeprofile', name:'Profile', element:EmployeeProfile},

  { path: '/pages/profile', name: null, element: AdminProfile },
  { path: '/pages/change-password', name: 'Change Password', element: ChangePassword },

  
  { path: '/base/tabs', name: null, element: Tabs },
  { path: '/base/tooltips', name: null, element: Tooltips },

  { path: '/buttons', name: null, element: Buttons, exact: true },
  { path: '/buttons/dropdowns', name: null, element: Dropdowns },
  { path: '/buttons/button-groups', name: null, element: ButtonGroups },


  { path: '/charts', name: null, element: Charts },

  { path: '/forms', name: null, element: FormControl, exact: true },
  { path: '/forms/form-control', name: null, element: FormControl },
  { path: '/forms/select', name: null, element: Select },
  { path: '/forms/checks-radios', name: null, element: ChecksRadios },
  { path: '/forms/range', name: null, element: Range },
  { path: '/forms/input-group', name: null, element: InputGroup },
  { path: '/forms/floating-labels', name: null, element: FloatingLabels },
  { path: '/forms/layout', name: null, element: Layout },
  { path: '/forms/validation', name: null, element: Validation },


  { path: '/icons', exact: true, name: null, element: CoreUIIcons },
  { path: '/icons/coreui-icons', name: null, element: CoreUIIcons },
  { path: '/icons/flags', name: null, element: Flags },
  { path: '/icons/brands', name: null, element: Brands },


  { path: '/notifications', name: null, element: Alerts, exact: true },
  { path: '/notifications/alerts', name: null, element: Alerts },
  { path: '/notifications/badges', name: null, element: Badges },
  { path: '/notifications/modals', name: null, element: Modals },
  { path: '/notifications/toasts', name: null, element: Toasts },
  { path: '/widgets', name: null, element: Widgets },
  { path: '/masters/:type', name: 'Masters', element: MasterModule },

  {
    path: '/employee-lifecycle/history',
    name: 'Employee Lifecycle History',
    element: () => {
      const role = localStorage.getItem("role")?.toLowerCase();
      return role === "admin"
        ? <EmployeeLifecycleHistory />
        : <Navigate to="/dashboard" replace />;
    }
  },
]

export default routes
