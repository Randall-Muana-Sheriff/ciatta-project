/**
 * "Starting with endometriosis."
 *
 * The only place on the page that names the condition. By the time she reads
 * it she has already recognised herself in the cycle, the pain week, the
 * laparoscopy and the ferritin trend, so this section only has to say why
 * that is where Ciatta begins, and that it does not end there.
 */

export function StartingSection() {
  return (
    <section className="section starting" aria-labelledby="starting-heading">
      <div className="shell">
        <div className="band-head">
          <h2 id="starting-heading" className="band-title">Starting with endometriosis.</h2>
        </div>

        <div className="st-body">
          <p className="st-lede">
            Endometriosis can touch pain, cycle, digestion, sleep, energy,
            mental health, treatments, medications, surgery, and more.
          </p>
          <p className="st-lede">
            That complexity is exactly why Ciatta was built to connect the
            pieces.
          </p>
          <p className="st-close">
            Endometriosis is where we’re starting. Ciatta is built for the
            health story beyond it.
          </p>
        </div>
      </div>
    </section>
  );
}
