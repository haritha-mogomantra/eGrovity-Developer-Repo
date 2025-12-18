import { FaArrowUp, FaArrowDown } from "react-icons/fa";

const SortIcon = ({ sortField, column, sortOrder }) => {
  const active = sortField === column;

  return (
    <span style={{ marginLeft: "6px" }}>
      <FaArrowUp
        size={10}
        color={active && sortOrder === "asc" ? "#007bff" : "#ccc"}
        style={{ marginRight: "2px" }}
      />
      <FaArrowDown
        size={10}
        color={active && sortOrder === "desc" ? "#007bff" : "#ccc"}
      />
    </span>
  );
};

export default SortIcon;
