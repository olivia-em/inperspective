import { Link } from "react-router"
import "./about.css"
import P5Sketch from "../routes/cassandra"
import ClientOnly from "../routes/clientonly"

export default function About() {
  return (
    <div className="about-container">
      <div className="about-content">
        <h1>written by <a target="_blank" href="https://oliviaem.glitch.me/">oliviaem</a></h1>
        <p class="desc"><i>Lessons in Perspective</i> is an interactive, web-based poetry collection that explores how every relationship is shaped by the ones that came before it. Built with React and Three.js, this collection makes the browser a space for 3D concrete poetry. 
           Your interaction with the present can unravel the past, illustrating connections that are invisible but felt. <i>Lessons in Perspective</i> offers a poetic meditation on love, memory, and the invisible architectures of life.</p>
        <Link to="/">[LIP]</Link>
        </div>
        <ClientOnly>
          <P5Sketch />
        </ClientOnly>
    </div>
  )
}

export function meta() {
  return [
    { title: "About | Lessons in Perspective" },
    { description: "About this collection" },
  ];
}