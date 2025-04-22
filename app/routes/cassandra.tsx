import React, { useEffect, useRef } from 'react'
import type p5 from 'p5'
import "./about.css"

interface P5Div {
  elt: HTMLElement
  html: (content: string) => void
  child: (element: any) => void
  id: (id: string) => P5Div
}

const P5Sketch: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalIds = useRef<number[]>([])

  useEffect(() => {
    let p5Instance: any = null

    const setupSketch = async () => {
      try {
        const [{ default: p5 }, { default: tracery }] = await Promise.all([
          import('p5'),
          import('tracery-grammar'),
        ])

        const sketch = (p: any) => {
          let questionDiv: P5Div, 
              memoryDiv: P5Div, 
              hallucinationDiv: P5Div, 
              outroDiv: P5Div, 
              introDiv: P5Div, 
              titleDiv: P5Div


        const questionSource = {
          origin: '#question#<br>recycle old words<br>no longer to read <br>you between lines',
          question: ['How many times can I', "I guess I'll just", 'Should I', 'How long would it take to'],
        }

        const memorySource = {
          origin: '<i>#question#</i>',
          question: [
            "You got played. It wasn't my intention, but you got played.",
            'I missed you.',
            'You have everything.',
            "I feel like you haven't really had a guy be in your corner... I can do that for you.",
            "Are we good or not? Cause I'm cold, I'm going upstairs.",
            'You kinda dress like a whore.',
            'You could have said something.',
            "This conversation isn't productive.",
            "I can't give you what you deserve.",
            "I don't think you want what you think you want.",
            "Well obviously there's something, it's not nothing.",
            "It's gonna be really hard to get drunk around you now.",
            "I don't want to be another guy in a long list of guys who've hurt her.",
          ],
        }

        const introSource = {
          origin: '#objectA#<br>to weigh down<br>#objectB#',
          objectA: ['only a handful', 'not much but enough'],
          objectB: ['the pockets of<br>my mind', 'my mind<br><br>'],
        }

        const outroSource = {
          origin: 'heavier is the silence<br>#objectA#<br>I am burdened by quiet<br>#objectB#<br>',
          objectA: [' ', 'over self-incrimination'],
          objectB: [' ', 'and text-hallucinations'],
        }

        const messageSource = {
          origin: '#object#',
          object: ["I'm sorry.", 'I mean it.', "You didn't deserve it."],
        }

        const splitmix32 = (seed: number) => {
          return function () {
            seed |= 0
            seed = (seed + 0x9e3779b9) | 0
            let t = seed ^ (seed >>> 16)
            t = Math.imul(t, 0x21f0aaad)
            t ^= t >>> 15
            t = Math.imul(t, 0x735a2d97)
            return ((t ^= t >>> 15) >>> 0) / 4294967296
          }
        }

      const generate = (
            div: P5Div,
            source: Record<string, string | string[]>,
            transform: (grammar: any) => string = (g) => g.flatten('#origin#')
          ) => {
            div.html('')
            const grammar = tracery.createGrammar(source)
            grammar.addModifiers(tracery.baseEngModifiers)
            div.child(p.createP(transform(grammar)))
          }

          p.setup = () => {
            p.noCanvas()
            tracery.setRng(splitmix32(123456))

            // Clear any existing intervals on re-setup
            intervalIds.current.forEach(clearInterval)
            intervalIds.current = []

            // Create divs
            const prev = document.getElementById("titleDiv")

            if (prev && prev.parentNode) {
                prev.parentNode.removeChild(prev)
              }

            titleDiv = p.createDiv("<strong><p>CASS&RA</p></strong>").id("titleDiv");
            questionDiv = p.createDiv('').id('questionDiv')
            introDiv = p.createDiv('').id('introDiv')
            memoryDiv = p.createDiv('').id('memoryDiv')
            outroDiv = p.createDiv('').id('outroDiv')
            hallucinationDiv = p.createDiv('').id('hallucinationDiv')

            // Only append elements if they don't already exist
            if (containerRef.current) {
              const existingIds = new Set(
                Array.from(containerRef.current.children).map(child => child.id)
              )

              const children = [
                questionDiv.elt,
                introDiv.elt,
                memoryDiv.elt,
                outroDiv.elt,
                hallucinationDiv.elt,
              ]

              children.forEach((child) => {
                if (!existingIds.has(child.id)) {
                  containerRef.current?.appendChild(child)
                }
              })
            }

            // Set up intervals
            intervalIds.current = [
              setInterval(() => generate(questionDiv, questionSource), 2000),
              setInterval(() => generate(introDiv, introSource), 1000),
              setInterval(() => generate(memoryDiv, memorySource), 100),
              setInterval(() => generate(outroDiv, outroSource), 1000),
              setInterval(
                () => generate(hallucinationDiv, messageSource, 
                  (g) => `<i>${g.flatten('#origin#')}</i>`
                ), 500
              )
            ]
          }
        }

        p5Instance = new p5(sketch)
      } catch (error) {
        console.error('Error setting up P5 sketch:', error)
      }
    }

    setupSketch()

    return () => {
      intervalIds.current.forEach(clearInterval)
      intervalIds.current = []
      if (p5Instance) {
        p5Instance.remove()
      }
    }
  }, [])

  return <div ref={containerRef} id="sketch-container" />
}

export default P5Sketch
