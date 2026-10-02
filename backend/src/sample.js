export const SAMPLE_PASSWORD = "123456";

const PEOPLE = [
  ["Karthik Raman", "Chennai", "Software Engineer", { name: "Raman Tech Solutions", industry: "IT Services", role: "Founder" }],
  ["Priya Sundaram", "Coimbatore", "Doctor"],
  ["Arun Kumar", "Bengaluru", "Product Manager"],
  ["Divya Lakshmi", "Chennai", "Chartered Accountant", { name: "DL & Associates", industry: "Finance", role: "Partner" }],
  ["Senthil Murugan", "Madurai", "Business Owner", { name: "Murugan Textiles", industry: "Textiles", role: "Owner" }],
  ["Meena Krishnan", "Dubai", "Architect"],
  ["Vignesh Babu", "Chennai", "Civil Engineer", { name: "VB Constructions", industry: "Construction", role: "Founder" }],
  ["Anitha Rajan", "Trichy", "Teacher"],
  ["Gokul Prasad", "Hyderabad", "Data Scientist"],
  ["Lavanya Sekar", "Chennai", "HR Manager"],
  ["Rahul Venkatesh", "Sydney", "Mechanical Engineer"],
  ["Sowmya Natarajan", "Pune", "Lawyer"],
  ["Dinesh Pandian", "Salem", "Business Owner", { name: "Pandian Agro Exports", industry: "Agriculture", role: "Director" }],
  ["Keerthana Mohan", "Chennai", "UX Designer"],
];

export function sampleMembers(inst, batches) {
  return PEOPLE.map(([name, city, occupation, business], i) => {
    const first = name.split(" ")[0].toLowerCase();
    return {
      batch: batches[i % batches.length],
      name,
      email: `${first}${i}@example.com`,
      mobile: String(9840000000 + i * 1371),
      dob: `19${80 + (i % 8)}-0${1 + (i % 9)}-1${i % 9}`,
      gender: i % 2 ? "Female" : "Male",
      blood: ["O+", "B+", "A+", "AB+"][i % 4],
      father: "Mr. " + ["Raman", "Sundaram", "Kumar", "Krishnan"][i % 4],
      mother: "Mrs. " + ["Lakshmi", "Meena", "Saraswathi", "Kamala"][i % 4],
      curAddr: `${12 + i}, Gandhi Street, ${city}`,
      city,
      nativeAddr: `${3 + i}, Main Road, ${["Thanjavur", "Tirunelveli", "Vellore", "Erode"][i % 4]}`,
      qualification: ["B.E.", "MBBS", "MBA", "B.Com, CA", "B.Sc", "B.Arch", "M.E."][i % 7],
      occupation,
      schools: [{ name: "Govt. Hr. Sec. School", board: "State Board", from: "1990", to: "2000" }],
      colleges: [{ name: "Anna University", degree: "B.E.", from: "2000", to: "2004" }],
      businesses: business ? [{ ...business, city, phone: "", web: "", desc: "Serving clients across Tamil Nadu." }] : [],
      links: [{ label: "LinkedIn", url: `linkedin.com/in/${first}` }],
      joinedAt: Date.now() - i * 1.3 * 864e5,
    };
  });
}
