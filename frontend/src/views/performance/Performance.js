import { useState } from "react";


const EmployeeForm =() =>{
    const [employeeId, setEmployeeId] = useState();
    const [employeeData, setEmployeeData] = useState(
        {
            name:"",
            department:"",
            manager:"",
            weeklyCalrnder:"",
            presentDate:"",
        }
    );
    const employeeDatabase ={
        1001:{name:"anil", department:"fullsatck", manager:"haritha"},
        1002:{name:"gopi", department:"backend", manager:"haritha"},
        1003:{name:"sandeep", department:"database", manager:"haritha"},
        1004:{name:"srinivas", department:"testing", manager:"haritha"},
    };
    
    const handleSearch=()=>{
        const data =employeeDatabase[employeeId];
        if (data){
            setEmployeeData({
                ...data,
                weeklyCalrnder:"",
                presentDate:"",
            });
        }else{
            alert("Employee ID not found!"),
            setEmployeeData({
                name:"",
                department:"",
                manager:"",
                weeklyCalrnder:"",
                presentDate:"",
            });
        }
        
    };

    const handlChange = (e)=>{
        setEmployeeData({...employeeData,[e.target.name]: e.target.value});
    };

    return(
        <div>
            <h2>Employee Information Form</h2>

            <div>
                <input type="text"
                placeholder="Enter Employee Id"
                value={employeeId}
                onChange={(e)=>setEmployeeId(e.target.value)}/>
                <button className="btn btn-primary" onClick={handleSearch}>Search</button>
            
            </div>
            <form>
                <div>
                    <div>
                        <div>
                            <label>Employee Name</label>
                            <input 
                            type="text"
                            placeholder="Employee Name"
                            name="name"
                            value={employeeData.name}
                            onChange={handlChange}/>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        
    )


}
export default EmployeeForm